const express = require('express')

const winston = require('winston')

require('dotenv').config()

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'sense' },
  transports: [
    new winston.transports.Console({}),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],

  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
})

const cors = require('cors')

const postgres = require('pg')

const uuid = require('uuid')

const configPostgres = process.env.PGADMIN_CONNECTION_URI || {
  host: process.env.POSTGRES_HOST,
  port: 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
}

let client

try {
  client = new postgres.Client(configPostgres)

  client.connect()

  const BYPASS_TOKEN = 'zenzeIsMoe'

  const environment = process.env.NODE_ENV || 'development'

  const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1] // Extract token from 'Bearer <token>' format

    if (environment === 'development') {
      req.locals = { token }

      next()
      return
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthenticated' })
    }

    if (token === BYPASS_TOKEN) {
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
  // // for JSON bodies
  app.use(express.urlencoded({ extended: true })) // for URL-encoded bodies

  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`)
    next()
  })

  app.get('/', authMiddleware, (req, res) => {
    res.send('Sense')
  })

  app.post('/slash', authMiddleware, async (req, res) => {
    const { url } = req.body

    if (typeof url === 'string') {
      const existed = await client.query(
        'SELECT * FROM link WHERE origin = $1',
        [url]
      )

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

        const message =
          'URL created successfully with URL ' +
          url +
          ' and short code ' +
          shortCode

        logger.info(makeLog(req, res, 'info', message))

        res.status(201).send({
          message,
          data: newRow,
        })
      }
    } else {
      const message = 'Invalid URL'

      logger.error(makeLog(req, res, 'error', message))

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
      const message = 'Short Code Not Found'

      logger.error(makeLog(req, res, 'error', message))

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

      logger.info(makeLog(req, res, 'info', 'URL deleted successfully'))

      res.send({
        message: 'URL deleted successfully',
        data: deleteRow,
      })
    } else {
      const message = 'Short Code Not Found'

      logger.error(makeLog(req, res, 'error', message))

      res.status(404).send(message)
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
      logger.error(makeLog(req, res, 'error', 'Not found'))

      res.status(404).send('Not found')
    }
  })

  app.get('/links', authMiddleware, async (req, res, ...rest) => {
    console.log(req.locals)

    const links = await client.query('SELECT * FROM link')

    res.send(links.rows)
  })

  app.get('/summary', authMiddleware, async (req, res) => {
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

    logger.info(
      makeLog(
        req,
        res,
        'info',
        JSON.stringify({ grouped, list: list.length }, null, 2)
      )
    )

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
      logger.info(
        makeLog(
          req,
          res,
          'info',
          `Found ${existed.length} visits for short code ${shortCode}`
        )
      )

      res.send(existed)
    } else {
      logger.error(makeLog(req, res, 'error', 'Not found'))

      res.status(404).send('Not found')
    }
  })

  app.post('/login', async (req, res) => {
    const { username, password } = req.body

    if (username === 'zenze' && password === 'sense') {
      logger.info(makeLog(req, res, 'info', 'Login successfully'))

      res.send({
        message: 'Login successfully',
        token: 'pendingToken',
      })
    } else {
      logger.error(makeLog(req, res, 'error', 'Invalid credentials'))

      res.status(401).send('Invalid credentials')
    }
  })

  app.get('/:shortCode', authMiddleware, async (req, res) => {
    if (req.params.shortCode === 'isxnj1n') {
      const { token = null } = { ...req?.locals }

      if (token !== BYPASS_TOKEN) {
        const message = `Unauthorized access to short code ${req.params.shortCode} with token ${token}`

        logger.error(makeLog(req, res, 'error', message))
        return res.status(404).send('no')
      }
    }

    const { shortCode } = req.params

    const queryResult = await client.query(
      'SELECT * FROM link WHERE short_code = $1',
      [shortCode]
    )

    const existed = queryResult?.rows?.[0]

    if (existed) {
      const timeNow = new Date()

      try {
        const insertVisit = await client.query(
          'INSERT INTO visit (short_code, time_visit) VALUES ($1, $2)',
          [existed.short_code, timeNow]
        )
      } catch (error) {
        logger.error(makeLog(req, res, 'error', error.message))
      }

      //? http:// or https://
      const url = `${existed.origin}`.startsWith('http')
        ? existed.origin
        : `https://${existed.origin}`

      return res.redirect(url)
    } else {
      const msg = `Short code ${shortCode} not found`

      logger.error(makeLog(req, res, 'error', msg))

      res.status(404).send(msg)
    }
  })

  app.listen(process.env.SERVICE_PORT, () => {
    console.log('Server is running on port' + process.env.SERVICE_PORT)
  })

  const makeLog = (req, res, level = 'info', message = '') => ({
    timestamp: new Date(),
    level,
    method: req.method,
    endpoint: req.originalUrl,
    status: res.statusCode,
    response_time_ms: res.getHeader('X-Response-Time') || 0,
    client_ip: req.ip,
    message,
  })
} catch (error) {
  console.log(error)
}
