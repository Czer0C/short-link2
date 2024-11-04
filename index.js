//express

const express = require('express')

const cors = require('cors')

const postgres = require('pg')

const uuid = require('uuid')

const configPostgres = process.env.DATABASE_URL || {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'changeme',
}

const client = new postgres.Client(configPostgres)

client.connect()

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1] // Extract token from 'Bearer <token>' format

  if (!token) {
    return res.status(401).json({ message: 'Unauthenticated' })
  }

  if (token === 'zenzeIsMoe') {
    next()
  } else {
    res.status(400).json({ message: 'Invalid token.' })
  }

  // try {
  //   const decoded = jwt.verify(token, 'zenzeIsMoe')

  //   req.user = decoded

  //   next()
  // } catch (error) {
  //   res.status(400).json({ message: 'Invalid token.' })
  // }
}

const app = express()

app.use(cors())

app.use(express.json())
// for JSON bodies
app.use(express.urlencoded({ extended: true })) // for URL-encoded bodies

app.get('/', authMiddleware, (req, res) => {
  res.send('Sense')
})

app.post('/slash', authMiddleware, async (req, res) => {
  const { url } = req.body

  if (typeof url === 'string') {
    const existed = await client.query('SELECT * FROM link WHERE origin = $1', [
      url,
    ])

    if (existed?.rows?.[0]) {
      res.status(400).send('URL already exists')
    } else {
      const timeNow = new Date()

      const shortCode = Math.random().toString(36).substring(6)

      const id = uuid.v4()

      const newRow = await client.query(
        'INSERT INTO link (id, origin, short_code, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [id, url, shortCode, timeNow, timeNow]
      )

      res.status(201).send({
        message: 'URL created successfully',
        data: newRow,
      })
    }
  } else {
    res.status(400).send('Invalid URL')

    return
  }
})

app.put('/slash/:shortCode', authMiddleware, async (req, res) => {
  const { shortCode } = req.params

  const { url } = req.body

  const existed = await client.query(
    'SELECT * FROM link WHERE short_code = $1',
    [shortCode]
  )

  if (existed?.rows?.[0]) {
    const timeNow = new Date()

    const updateRow = await client.query(
      'UPDATE link SET origin = $1, updated_at = $2 WHERE short_code = $3',
      [url, timeNow, shortCode]
    )

    res.send({
      message: 'URL updated successfully',
      data: updateRow,
    })
  } else {
    res.status(404).send('Short Code Not Found')
  }
})

app.delete('/slash/:shortCode', authMiddleware, async (req, res) => {
  const { shortCode } = req.params

  const existed = await client.query(
    'SELECT * FROM link WHERE short_code = $1',
    [shortCode]
  )

  if (existed?.rows?.[0]) {
    const deleteRow = await client.query(
      'DELETE FROM link WHERE short_code = $1',
      [shortCode]
    )

    res.send({
      message: 'URL deleted successfully',
      data: deleteRow,
    })
  } else {
    res.status(404).send('Not found')
  }
})

app.get('/slash/:shortCode', authMiddleware, async (req, res) => {
  const { shortCode } = req.params

  const queryResult = await client.query(
    'SELECT * FROM link WHERE short_code = $1',
    [shortCode]
  )

  const existed = queryResult?.rows?.[0]

  if (existed) {
    res.send(existed)
  } else {
    res.status(404).send('Not found')
  }
})

app.get('/links', authMiddleware, async (req, res) => {
  const links = await client.query('SELECT * FROM link')

  res.send(links.rows)
})

app.get('/:shortCode', authMiddleware, async (req, res) => {
  const { shortCode } = req.params

  const queryResult = await client.query(
    'SELECT * FROM link WHERE short_code = $1',
    [shortCode]
  )

  const existed = queryResult?.rows?.[0]

  if (existed) {
    const timeNow = new Date()

    const insertVisit = await client.query(
      'INSERT INTO visit (short_code, time_visit) VALUES ($1, $2)',
      [existed.short_code, timeNow]
    )

    res.redirect(existed.origin)
  } else {
    res.status(404).send('Not found')
  }
})

app.get('/summary/visit', authMiddleware, async (req, res) => {
  const queryResult = await client.query('SELECT * FROM visit')

  const list = queryResult?.rows

  const grouped = list.reduce((acc, cur) => {
    if (acc[cur.short_code]) {
      acc[cur.short_code]++
    } else {
      acc[cur.short_code] = 1
    }

    return acc
  }, {})

  res.send({ grouped, list })
})

app.get('/stat/:shortCode', authMiddleware, async (req, res) => {
  const { shortCode } = req.params

  const queryResult = await client.query(
    'SELECT * FROM visit WHERE short_code = $1',
    [shortCode]
  )

  const existed = queryResult?.rows

  if (existed) {
    res.send(existed)
  } else {
    res.status(404).send('Not found')
  }
})

app.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (username === 'zenze' && password === 'sense') {
    res.send({
      message: 'Login successfully',
      token: 'pendingToken',
    })
  } else {
    res.status(401).send('Unauthorized')
  }
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
