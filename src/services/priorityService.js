import PriorityResult from "../models/PriorityResult.js";
import Report from "../models/Report.js";
import fetch from "node-fetch";

// HELPER: Ambil data jalan dari OpenStreetMap
// Input: koordinat GPS dari laporan
// Output: kategori jalan (motorway/trunk/primary/secondary/dst)
const getRoadCategory = async (lat, lon) => {
  try {
    const query = `
      [out:json][timeout:10];
      way(around:50,${lat},${lon})["highway"];
      out tags;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.elements || data.elements.length === 0) return 'unknown';

    // Ambil jalan terdekat 
    const highway = data.elements[0].tags?.highway || 'unknown';
    return highway;

  } catch (error) {
    console.error(`getRoadCategory error: ${error.message}`);
    return 'unknown'; 
  }
};


// HELPER: Hitung skor kategori jalan
// Makin penting jalan, makin tinggi skornya

const calcRoadCategoryScore = (highway) => {
  const roadScores = {
    // Jalan tol / nasional utama
    motorway:      1.0,
    motorway_link: 0.9,
    trunk:         0.9,
    trunk_link:    0.85,
    // Jalan nasional / provinsi
    primary:       0.8,
    primary_link:  0.75,
    secondary:     0.65,
    secondary_link:0.6,
    // Jalan kabupaten / kota
    tertiary:      0.5,
    tertiary_link: 0.45,
    // Jalan lokal / lingkungan
    residential:   0.3,
    living_street: 0.2,
    service:       0.15,
    track:         0.1,
    path:          0.05,
    unknown:       0.3  
  };
  return roadScores[highway] ?? 0.3;
};

// HELPER: Hitung jarak ke fasilitas publik terdekat
const getNearestFacilityScore = async (lat, lon) => {
  try {
    // Query fasilitas publik penting dalam radius 1km
    const query = `
      [out:json][timeout:10];
      (
        node(around:1000,${lat},${lon})["amenity"~"hospital|school|clinic|police|fire_station|government"];
        way(around:1000,${lat},${lon})["amenity"~"hospital|school|clinic|police|fire_station|government"];
      );
      out count;
    `;
    const url  = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res  = await fetch(url);
    const data = await res.json();

    const facilityCount = data.elements?.[0]?.tags?.total || 0;

    // Makin banyak fasilitas publik di sekitar → makin urgent diperbaiki
    if (facilityCount >= 3) return 1.0;
    if (facilityCount === 2) return 0.7;
    if (facilityCount === 1) return 0.5;
    return 0.2; // tidak ada fasilitas publik terdekat

  } catch (error) {
    console.error(`getNearestFacilityScore error: ${error.message}`);
    return 0.3; 
  }
};

// HELPER: Hitung skor kerusakan dari hasil YOLO
const calcDamageScore = (damageSummary) => {
  if (!damageSummary) return 0.3;

  const { severity_hint, pothole_count, crack_count, max_confidence } = damageSummary;

  // Base score dari severity hint
  let score = 0.3;
  if (severity_hint === 'high')   score = 0.9;
  if (severity_hint === 'medium') score = 0.6;
  if (severity_hint === 'low')    score = 0.3;

 //total damage dari jumlah kerusakan yang terdeteksi
  const totalDamage = (pothole_count || 0) + (crack_count || 0);
  if (totalDamage >= 4) score = Math.min(score + 0.15, 1.0);
  else if (totalDamage >= 2) score = Math.min(score + 0.08, 1.0);

  // confidence dari model YOLO — kalau tinggi, berarti lebih yakin kerusakannya nyata
  if (max_confidence >= 0.85) score = Math.min(score + 0.05, 1.0);

  return parseFloat(score.toFixed(2));
};

// MAIN: Calculate Priority
export const calculatePriority = async (reportId, damageSummary = null) => {
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      console.error(`Report tidak ditemukan: ${reportId}`);
      return;
    }

    console.log(`Menghitung priority untuk ${report.reportId}...`);

    const [roadCategory, facilityScore, nearbyCount] = await Promise.all([
      getRoadCategory(report.latitude, report.longitude),
      getNearestFacilityScore(report.latitude, report.longitude),
      // Hitung laporan lain di radius 100 meter
      Report.countDocuments({
        _id:    { $ne: report._id },
        status: { $ne: 'rejected' },
        latitude:  { $gte: report.latitude  - 0.001, $lte: report.latitude  + 0.001 },
        longitude: { $gte: report.longitude - 0.001, $lte: report.longitude + 0.001 }
      })
    ]);

    // Hitung semua skor
    const damageScore    = calcDamageScore(damageSummary);
    const roadScore      = calcRoadCategoryScore(roadCategory);
    const frequencyScore = Math.min(nearbyCount * 0.25, 1.0);
    const hoursSince     = (Date.now() - new Date(report.submittedAt).getTime()) / (1000 * 3600);
    const ageScore       = parseFloat(Math.min(hoursSince / 72, 1.0).toFixed(2));

    // Bobot scoring — total harus = 1.0
    const priorityScore = (
      damageScore    * 0.40 +  // kerusakan dari AI — paling dominan
      roadScore      * 0.20 +  // kategori jalan
      facilityScore  * 0.25 +  // jarak ke fasilitas publik
      frequencyScore * 0.10 +  // frekuensi laporan area sama
      ageScore       * 0.05    // usia laporan
    );

    // Tentukan label
    let priorityLabel = 'low';
    if (priorityScore >= 0.65)      priorityLabel = 'high';
    else if (priorityScore >= 0.40) priorityLabel = 'medium';

    // Simpan ke database
    const priorityResult = new PriorityResult({
      reportId:            report._id,
      severityScore:       damageScore,
      trafficScore:        roadScore,
      frequencyScore:      parseFloat(frequencyScore.toFixed(2)),
      publicFacilityScore: parseFloat(facilityScore.toFixed(2)),
      ageScore,
      priorityScore:       parseFloat(priorityScore.toFixed(2)),
      priorityLabel
    });

    await priorityResult.save();
    await Report.findByIdAndUpdate(report._id, { status: 'prioritized' });

    console.log(` Priority ${report.reportId}: ${priorityLabel.toUpperCase()} (${priorityScore.toFixed(2)})`);
    console.log(` Damage: ${damageScore} |  Road: ${roadScore} (${roadCategory})`);
    console.log(` Facility: ${facilityScore} |  Freq: ${frequencyScore} |  Age: ${ageScore}`);

  } catch (error) {
    console.error(` Priority scoring error: ${error.message}`);
  }
};