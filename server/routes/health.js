import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Hello from Background Remover API!' })
})

export default router
