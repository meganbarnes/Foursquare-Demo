'use strict'

const getVenues = require('./lib/getVenues')

const firstOfEntityRole = function(message, entity, role) {
  role = role || 'generic';

  const slots = message.slots
  const entityValues = message.slots[entity]
  const valsForRole = entityValues ? entityValues.values_by_role[role] : null

  return valsForRole ? valsForRole[0] : null
}

exports.handle = function handle(client) {
  const sayHello = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().helloSent)
    },

    prompt() {
      client.addResponse('app:response:name:welcome')
      client.addResponse('app:response:name:provide/documentation', {
        documentation_link: 'http://docs.init.ai',
      })
      client.addResponse('app:response:name:provide/instructions')
      client.updateConversationState({
        helloSent: true
      })
      client.done()
    }
  })

  const untrained = client.createStep({
    satisfied() {
      return false
    },

    prompt() {
      client.addResponse('app:response:name:apology/untrained')
      client.done()
    }
  })

  const collectNear = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().near)
    },

    extractInfo() {
     const place = firstOfEntityRole(client.getMessagePart(), 'place')
      if (place) {
        client.updateConversationState({
          near: place,
        })
        console.log('User wants venues near:', place.value)
      }
    },

    prompt() {
      client.addResponse('app:response:name:prompt/near_place')
      client.done()
    },
  })

  const collectQuery = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().query)
    },

    extractInfo() {
     const type = firstOfEntityRole(client.getMessagePart(), 'type')
      if (type) {
        client.updateConversationState({
          query: type,
        })
        console.log('User wants:', type.value)
      }
    },

    prompt() {
      client.addResponse('app:response:name:prompt/query_type')
      client.done()
    },
  })

  const provideVenues = client.createStep({
    satisfied() {
      return false
    },

    prompt(callback) {
      getVenues(resultBody => {
        if (!resultBody || resultBody.meta.code !== 200) {
          console.log('Error getting venues.')
          callback()
          return
        }

        var resultLen = resultBody.response.venues.length
        var carouselArray = []
        var i = 0
        for (i = 0; i < resultLen; i++) {
          var  carouselItemData = {
            'media_url': `http://cache.boston.com/bonzai-fba/Original_Photo/2011/11/23/pizza__1322067494_5957.jpg`,
            'media_type': 'image/jpeg', 
            'description': 'Pizza Place.',
            title: resultBody.response.venues[i].name,
            actions: [
              {
                type: 'link',
                text: 'Visit page',
                uri: resultBody.response.venues[i].url,
              },
            ],
          }
          if carouselItemData.actions.uri === undefined {
            console.log("No website")
          } else {
            carouselArray.push(carouselItemData)
          }
        }

        console.log('sending venues:', carouselArray)
        client.addCarouselListResponse({ items: carouselArray })
        client.done()

        callback()
      })
    },
  })

  client.runFlow({
    classifications: {},
    streams: {
      main: 'getVenues',
      hi: [sayHello],
      getVenues: [provideVenues],
    }
  })
}
