const qrcode = require('qrcode-terminal')
const { Client, MessageMedia } = require('whatsapp-web.js')
const express = require('express')
const AWS = require('aws-sdk')
const Heroku = require('heroku-client')
const raygun = require('raygun')


const raygunClient = new raygun.Client().init({apiKey: process.env.RAYGUN_APIKEY})
const heroku = new Heroku({ token: process.env.HEROKU_API_KEY })

;(async () => {

  try {
    const app = express()
    const port = process.env.PORT

    app.use(express.json({ limit: '50mb' }))
    app.use(raygunClient.expressHandler)

    app.listen(port, () => {
      console.log(`App listening at http://localhost:${port}`)
    })

    ////////////////////////////////////////////////////////////////

    const { AWS_ID, AWS_SECRET, BUCKET_NAME } = process.env
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

    client.on('message', message => {
      console.log(message.body)
      if (message.body === 'ping') {
        message.reply('pong')
      }
    })

    client.initialize()

    ////////////////////////////////////////////////////////////////

    const chatId = process.env.PHONE.replace('+', '') + '@c.us'

    app.post('/api', (req, res) => {
      const { message, image } = req.body
      console.log(`${message}\ncontains image: ${!!image}`)
      if (image) {
        const media = new MessageMedia(image.type, image.data)
        client.sendMessage(chatId, media, { caption: message })
      }
      else {
        client.sendMessage(chatId, message)
      }
      res.send({ success: true })
    })

  }
  catch (e) {
    console.error(e)
    console.log('Error, app will restart in 1 hour')
    await new Promise(r => setTimeout(r, 3600000))
    heroku.delete('/apps/whatsapp-node-server/dynos')
  }
  
})()
