const qrcode = require('qrcode-terminal')
const { Client, MessageMedia } = require('whatsapp-web.js')
const express = require('express')
const AWS = require('aws-sdk')

/////////////////////////////////////////////////////////////////

const app = express()
const port = process.env.PORT || 3000

app.use(express.json({ limit: '50mb' }))

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})

////////////////////////////////////////////////////////////////

const AWS_ID = process.env.AWS_ID
const AWS_SECRET = process.env.AWS_SECRET
const BUCKET_NAME = 'whatsapp-node-server-s3-bucket'
const FILE_NAME = 'session.json'

const s3 = new AWS.S3({
  accessKeyId: AWS_ID,
  secretAccessKey: AWS_SECRET
})

async function uploadFile(fileContent) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: FILE_NAME,
    Body: fileContent
  }
  try {
    await s3.upload(params).promise()
    console.log('"session.json" stored')
  } catch (e) {
    console.log(e)
  }
}

async function getFile() {
  try {
    const file = await s3
      .getObject({ Bucket: BUCKET_NAME, Key: FILE_NAME })
      .promise()
    return JSON.parse(file.Body.toString())
  } catch (e) {
    console.log(e)
  }
}

let sessionData

; (async () => {
  console.log('Checking if "session.json" exists...')
  const params = {
    Bucket: BUCKET_NAME,
    Key: FILE_NAME
  }
  try {
    await s3.headObject(params).promise()
    console.log('"session.json" found')
    sessionData = await getFile()
  }
  catch (e) {
    if (e.code === 'NotFound') {
      console.log('"session.json" not found')
    }
  }

  // Use the saved values
  const client = new Client({
    session: sessionData,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--unhandled-rejections=strict'
      ]
    }
  })

  // Save session values to the file upon successful auth
  client.on('authenticated', session => {
    sessionData = session
    uploadFile(JSON.stringify(session))
  })

  client.on('qr', qr => {
    qrcode.generate(qr, { small: true })
  })

  client.on('ready', () => {
    console.log('Client is ready!')
  })

  client.initialize()

  ////////////////////////////////////////////////////////////////

  const chatId = '972546313551' + '@c.us'

  app.post('/api', (req, res) => {
    const { message, image } = req.body
    console.log(message)
    if (image) {
      const media = new MessageMedia(image.type, image.data)
      client.sendMessage(chatId, media, { caption: message })
    }
    else {
      client.sendMessage(chatId, message)
    }
    res.send({ success: true })
  })

})()
