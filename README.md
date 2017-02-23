This is enables the bootstrapping of a [WebRTC tree overlay](https://github.com/elavoie/webrtc-tree-overlay) through its root node.

Any potential peer connects to the bootstrap server and request a connection.
If a peer knows to whom it should connect it specifies the destination id.
Otherwise, the connection request will be forwarded to the root node, which is
then responsible for either accepting the connection or passing it down to one
or more of its children through an already existing connection.

# Usage

    var bootstrap = require('webrtc-tree-overlay-bootstrap')
    var SimplePeer = require('simple-peer')

    // On the root node
    var bootstrap = new Client('bootstrap-server hostname or ip address')
    
    var newcomers = {}

    bootstrap.root('secret', function (req) {
      console.log('root received: ' + JSON.stringify(req))

      // Remember previously created peers to route multiple
      // signals if they all don't have a destination yet
      if (!newcomers[req.origin]) {
        console.log('Creating connection to signaling peer')
        var p = new SimplePeer()
        newcomers[req.origin] = p
        bootstrap.connect(p, req.origin)
      }

      newcomers[req.origin].signal(req.signal)
    })

    bootstrap.connect(new SimplePeer({ initiator: true }))

# Bootstrap client

Enables establishing WebRTC connections between peers.

## bootstrap.root(secret, onRequest(req))

To prevent unauthorized connections to become the root, a node must specify the
*secret* that has been set up during the server configuration (see below in the
server configuration).

*onRequest(req)* is a callback that will be called with a request object with
the following properties:
  - *origin*: the identifier of the originator of the request
  - *signal*: the SimplePeer signal to establish the WebRTC connection. Because of the ICE trickle protocol for signaling, the same peer may trigger multiple calls to *onRequest*. It is the responsibility of the root node to ensure all the requests will be routed to the same node.

## bootstrap.connect(peer, [destination])

*peer* should be a [SimplePeer](https://github.com/feross/simple-peer)

*destination* is the identifier of the peer to whom we want to open a connection to. If destination is undefined, the connection request will be sent to the root.

After a connection has been initiated:

    1. If the connection fails, *peer* will emit a 'Bootstrap timeout' error.
    2. *peer* emits the 'identifier' event with the id it has been assigned by
the bootstrap server.

# Bootstrap server

The server can be deployed on any public server (server with a public IP
address) that supports WebSockets.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Secret configuration

Please fork this repository and change the secret in the config.json file to
ensure only your root node can connect as root to the bootstrap server.
