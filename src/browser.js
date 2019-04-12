var Client = require('..')
var debug = require('debug')
var log = debug('webrtc-bootstrap')

module.exports = function browser (host, origin, secure) {
  var bootstrap = new Client(host, { secure: secure })
  var p = bootstrap.connect(null, {
    peerOpts: {
      config: {
        iceServers: [{
          urls: 'stun:stun.l.google.com:19302'
        }]
      },
      wrtc: undefined
    }
  })
  p.on('connect', function () { 
    console.log('connected to root, sending: ' + origin)
    p.send(origin)
  })
  p.on('data', function (data) {
    console.log('received data from root: ' + String(data)) 
  })
}
