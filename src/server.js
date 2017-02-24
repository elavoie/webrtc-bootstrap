var http = require('http')
var ws = require('ws')
var debug = require('debug')
var log = debug('webrtc-tree-overlay-signaling')
var randombytes = require('randombytes')
var express = require('express')
var app = express()
var path = require('path')
app.use(express.static(path.join(__dirname, '../public')))

function Server (port, secret) {
  port = port || process.env.PORT || 5000
  secret = secret || process.env.SECRET

  if (!secret) {
    throw new Error('Invalid secret: ' + secret)
  }

  var root = null
  var prospects = {}
  function closeProspect (id) {
    if (prospects[id]) prospects[id].close()
  }

  function messageHandler (id) {
    return function incomingMessage (message) {
      message = JSON.parse(message)
      message.origin = id
      log('INCOMING MESSAGE')
      log(message)
      if (message.destination) {
        log('Destination defined')
        if (prospects.hasOwnProperty(message.destination)) {
          log('Known destination ' + message.destination)
          prospects[message.destination].send(JSON.stringify(message), function (err) {
            if (err) closeProspect(message.destination)
          })
        } else {
          log('Unknown destination ' + message.destination + ', ignoring message')
        }
      } else {
        if (root) root.send(JSON.stringify(message))
      }
    }
  }

  this.httpServer = http.createServer(app)
  this.httpServer.listen(port)
  console.log('http server listening on %d', port)

  console.log('Opening websocket connection for root on ' + secret)

  this.server = new ws.Server({server: this.httpServer})
    .on('connection/' + secret, function (ws) {
      log('root connected for webrtc-signaling')
      ws.on('message', function (data) {
        log('WARNING: unexpected message from root: ' + data)
      })
      root = ws
    })
    .on('connection/join', function (ws) {
      function remove () {
        log('node ' + id + ' disconnected')
        delete prospects[id]
      }
      var id = ws.id = randombytes(16).hexSlice()
      log('node connected with id ' + id)
      ws.on('message', messageHandler(id))
      ws.on('close', remove)
      prospects[id] = ws
      setTimeout(function () {
        closeProspect(id)
      }, 30 * 1000)
    })

  return this
}

module.exports = Server
