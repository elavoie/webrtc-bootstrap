var client = require('./client')

if (typeof window === 'undefined') {
  client.Server = require('./server')
}

module.exports = client
