var Client = require('../src/client')
var fs = require('fs')
var path = require('path')
var Peer = require('simple-peer')
var wrtc = require('electron-webrtc')()

var config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json')))
var bootstrap = new Client(config['host' + (process.argv.length > 2 ? '-' + process.argv[2] : '')])

var newcomers = {}

bootstrap.root(config['secret'], function (req) {
  console.log('root received: ' + JSON.stringify(req))

  // Remember previously created peers to route multiple
  // signals if they all don't have a destination yet
  if (!newcomers[req.origin]) {
    console.log('Creating connection to signaling peer')
    var p = new Peer({ wrtc: wrtc })
    newcomers[req.origin] = p
    bootstrap.connect(p, req.origin)
  }

  console.log('Forwarding to existing peer ' + req.origin)
  newcomers[req.origin].signal(req.signal)
})

bootstrap.connect(new Peer({ initiator: true, wrtc: wrtc }))
