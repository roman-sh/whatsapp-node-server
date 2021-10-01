const qrcode = require('qrcode-terminal')
const { Client, MessageMedia } = require('whatsapp-web.js')
const express = require('express')
const fs = require('fs')


const app = express()
const port = process.env.PORT || 3000

app.use(express.json({limit: '50mb'}))
// app.use(express.urlencoded())

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})


// Path where the session data will be stored
const SESSION_FILE_PATH = './session.json'

// Load the session data if it has been previously saved
let sessionData
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH)
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
  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session))
})

client.on('qr', qr => {
  qrcode.generate(qr, { small: true })
})

client.on('ready', () => {
  console.log('Client is ready!')
})

client.initialize()


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

