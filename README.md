This library enables the bootstrapping of a WebRTC overlay made of [Simple
Peers](https://github.com/feross/simple-peer). 

The handshake between the requester and the answerer are performed over
WebSockets connected to the bootstrap server. After the handshake has been
performed the websocket connections are closed to conserve resources.

Any potential peer connects to the bootstrap server and requests a connection.
The request is passed to the root which is then responsible for either
accepting the connection or passing it down to another peer through an already
existing connection. Any peer may fulfill the request it received by creating a
connection to the request originator through the bootstrap server.


# Usage

    // On the root process

    var bootstrap = require('webrtc-tree-overlay-bootstrap')('bootstrap-server hostname or ip-address:port')
    var newcomers = {}

    // Register to obtain requests
    bootstrap.root('secret', function (req) {
      console.log('root received: ' + JSON.stringify(req))

      // Remember previously created peers.  
      // This way we can route multiple WebRTC handshake signals generated 
      // by the ICE Trickle protocol to the same peer
      if (!newcomers[req.origin]) {
        console.log('Creating connection to signaling peer')
        newcomers[req.origin] = bootstrap.connect(req)
        newcomers[req.origin].on('data', console.log)
      } else {
        // Pass the signal data
        newcomers[req.origin].signal(req.signal)
      }
    })

    // From a different process

    var bootstrap = ...
    var p = bootstrap.connect()
    p.on('connect', function () { p.send('hello') })

# Bootstrap client

## bootstrap.root(secret, onRequest(req))

*secret* is an alphanumeric string that has been set up during the server
configuration (see below in the server configuration). It becomes a route for
the root WebSocket connection. It ensures only the the authorized root will
receive requests.

*onRequest(req)* is a callback that will be called with a request object,
itself with the following properties:
  - `req.origin`: the identifier of the originator of the request
    (automatically created by the bootstrap server)
  - `req.signal`: the SimplePeer signal to establish the WebRTC connection.
    Because of the ICE trickle protocol for signaling, the same peer may
    trigger multiple calls to *onRequest* (unless `peerOpts.tricke: false`). 
    All subsequent requests should be routed to the same peer.

## peer =  bootstrap.connect([req, peerOpts])

*req* is a request object (see `bootstrap.root`).  If it is `undefined` or
`falsy`, `initiator: true` will be set on *peerOpts* to initiate the signaling
protocol. All the requests will go to the root. Otherwise, if a valid *req* is
used, then a WebSocket connection will be established with the originator
(`req.origin`) through the bootstrap server to answer the signaling offer and
finish the handshake. 

*peerOpts* are options to be passed to the [SimplePeer](https://github.com/feross/simple-peer) constructor. Defaults to `{}`.

Returns *peer*, a [SimplePeer](https://github.com/feross/simple-peer) instance.

Any following requests by the same originator (`req.origin`) should to be given
manually to the peer with `peer.signal(req.signal)`.

After a connect call if the connection succeeds, *peer* will emit the usual 'connect' event. 
Two new events are added compared to the basic Simple Peer:
  1. If the connection fails, *peer* will emit a 'Bootstrap timeout' error.
  2. During the handshake protocol, *peer* emits the 'identifier' event with
     the id it has been assigned by the bootstrap server.

# Bootstrap server

The server can be run locally for tests or deployed on any public server
(server with a public IP address) that supports WebSockets.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Usage

    # Using the configuration file
    node bin/server path_to_config.json

    # Or using environment variables
    SECRET=12345 node bin/server

## Secret configuration

Please clone this repository, copy config.example.json to config.json, and
change the secret in the config.json file to ensure only your root node can
connect as root to the bootstrap server.

# Projects

This library is used by the the following
[library](https://github.com/elavoie/webrtc-tree-overlay) to organize peers in
a tree. 

Submit a pull-request to add your own!

