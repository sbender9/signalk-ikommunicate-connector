/*
 * Copyright 2020 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const WebSocket = require('ws')

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = []
  var reconnectTimer
  var connection

  plugin.start = function(props) {
    const url = `ws://${props.ipaddress}:${props.port}/signalk/v1/stream?subscribe=all`
    connect(url)
  }

  function connect(url) {
    try
      {
        connection = new WebSocket(url, "ws");
      }
      catch ( e )
      {
        app.setProviderError(e.message)
        app.error(`${e}: creating websocket for url: ${url}`);
        return
      }

    connection.onopen = function() {
      app.setProviderStatus(`Connected to ${url}`)
      app.debug('connected');
      
      if ( reconnectTimer ) {
        clearInterval(reconnectTimer)
        reconnectTimer = null;
      }
    }

    connection.onerror = function(error) {
      app.setProviderError(error.message)
      app.error('connection error: ' + url);
      app.error(error.stack)
    }

    connection.onmessage = function(msg) {
      var delta = JSON.parse(msg.data)
      delta.context = 'vessels.self'
      app.handleMessage(plugin.id, delta)
    }

    connection.onclose = function(event) {
      app.setProviderError(`connection closed: ${url}`)
      app.debug('connection closed %s', url);
      connection = null
      reconnectTimer = setInterval(() => {
        connect(url)
      }, 10000)
    }
  }

  plugin.stop = function() {
    if ( connection ) {
      app.debug('closing connection')
      connection.onclose = null;
      connection.close();
      connection = null
    }
  }
  
  plugin.id = "signalk-ikommunicate-connector"
  plugin.name = "iKommunicate Connector"
  plugin.description = "SignalK Node Server plugin to get data from an iKommunicate"

  plugin.schema = {
    type: "object",
    required: ['ipaddress', 'port'],
    properties: {
      ipaddress: {
        type: 'string',
        title: 'Address for the iKommunicate'
      },
      port: {
        type: 'number',
        title: 'The port of the iKommunicate',
        default: 80
      }
    }
  }

  return plugin;
}
