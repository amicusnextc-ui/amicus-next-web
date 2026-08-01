// /api/album — Apple 공유앨범 프록시 (26 VISION RETREAT)
const TOKEN = "B1z5oqs3qGx9FGG";

export default async function handler(req, res) {
  try {
    const base = `https://sharedstreams.icloud.com/${TOKEN}/sharedstreams/webstream`;
    let r = await fetch(base, { method: "POST", body: JSON.stringify({ streamCtag: null }) });
    let j = await r.json();
    let host = j["X-Apple-MMe-Host"] || "sharedstreams.icloud.com";
    if (j["X-Apple-MMe-Host"]) {
      r = await fetch(`https://${host}/${TOKEN}/sharedstreams/webstream`, { method: "POST", body: JSON.stringify({ streamCtag: null }) });
      j = await r.json();
    }
    const photos = j.photos || [];
    const want = (req.query.guids || "").split(",").filter(Boolean);
    const sel = want.length ? want.map(g => photos.find(p => p.photoGuid === g)).filter(Boolean) : photos;
    const r3 = await fetch(`https://${host}/${TOKEN}/sharedstreams/webasseturls`, { method: "POST", body: JSON.stringify({ photoGuids: sel.map(p => p.photoGuid) }) });
    const assets = (await r3.json()).items || {};
    const out = sel.map(p => {
      const keys = Object.keys(p.derivatives || {}).sort((a, b) => parseInt(b) - parseInt(a));
      const pick = k => { const d = p.derivatives[k]; if (!d) return null; const it = assets[d.checksum]; return it ? `https://${it.url_location}${it.url_path}` : null; };
      return { guid: p.photoGuid, date: p.dateCreated, big: pick(keys[0]), thumb: pick(keys[keys.length - 1]) };
    });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ name: j.streamName, count: photos.length, photos: out });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
