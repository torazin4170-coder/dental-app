export default function handler(_req, res) {
  res.status(200).json({ ok: true, message: 'API is running' })
}
