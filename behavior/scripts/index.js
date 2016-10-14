'use strict'

const getVenues = require('./lib/getVenues')
const request = require('request')

const firstOfEntityRole = function(message, entity, role) {
  role = role || 'generic';

  const slots = message.slots
  const entityValues = message.slots[entity]
  const valsForRole = entityValues ? entityValues.values_by_role[role] : null

  return valsForRole ? valsForRole[0] : null
}

const getLatLong = function(near, callback) {
  const key = `Ar8_lxvb7vC3wD8KmSuFLQyR7QwhDWTCInXrvCNjFQZz4o2wdG1Y60uWNT-zxHYn`

  const requestUrl = `http://dev.virtualearth.net/REST/v1/Locations?query=${near}&key=${key}`

  console.log('Making HTTP GET request to:', requestUrl)

  const parsedResult = request(requestUrl, (err, res, body) => {
    if (err) {
      throw new Error(err)
    }

    if (body) {
      const parsedResult = JSON.parse(body)
      console.log('parsed result', parsedResult)
      callback(parsedResult)
    }
  })
}


exports.handle = function handle(client) {
  const sayHello = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().helloSent)
    },

    prompt() {
      client.addTextResponse('Welcome to Foursquare!  How can I help?')
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

    extractInfo(callback) {
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
      getLatLong(client.getConversationState().near.value, (resultBody) => {
          if (!resultBody || resultBody.statusCode !== 200) {
            console.log('Error getting lat/lon.')
            client.updateConversationState({
              near: place,
              convertedNear: false,
            })
          } else {
            console.log('Got em')
            client.updateConversationState({
              near: {
                value: resultBody.resourceSets[0].resources[0].point.coordinates[0].toString()+','+resultBody.resourceSets[0].resources[0].point.coordinates[1].toString(),
                raw_value: client.getConversationState().near.raw_value,
                canonicalized: client.getConversationState().near.canonicalized,
                parsed: client.getConversationState().near.parsed,
              },
              convertedNear: true,
            })
            console.log('conv state:', client.getConversationState())
            getVenues(client.getConversationState().query.value, client.getConversationState().near.value, client.getConversationState().convertedNear, resultBody => {
              if (!resultBody || resultBody.meta.code !== 200) {
                console.log('Error getting venues.')
                callback()
                return
              }

              var resultLen = resultBody.response.venues.length
              var carouselArray = []
              var i = 0
              for (i = 0; i < resultLen; i++) {
                var u = 'http://google.com'
                if (resultBody.response.venues[i].url === undefined) {
                  u = 'http://bing.com'
                } else {
                  u = resultBody.response.venues[i].url
                }
                var  carouselItemData = {
                  'media_url': 'https://foursquare.com'+resultBody.response.venues[i].categories[0].icon.prefix.slice(20,resultBody.response.venues[i].categories[0].icon.prefix.length)+'bg_64'+resultBody.response.venues[i].categories[0].icon.suffix,
                  'media_type': 'image/jpeg', 
                  'description': resultBody.response.venues[i].location.formattedAddress,
                  title: resultBody.response.venues[i].name.slice(0,78),
                  actions: [
                    {
                      type: 'link',
                      text: 'Visit page',
                      uri: u,
                    },
                  ],
                }
                carouselArray.push(carouselItemData)
              }

              console.log('sending venues:', carouselArray)

              const queryData = {
                type: client.getConversationState().query.value,
                place: client.getConversationState().near.raw_value,
              }

              client.addResponse('app:response:name:provide/venues', queryData)
              client.addCarouselListResponse({ items: carouselArray })
              client.done()

              callback()
            })
          }
        })
        console.log('User wants venues near:', client.getConversationState().near)

      
    },
  })

  

  



  const askForConfirmation = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().startOver)
    },

    prompt() {
      client.addTextResponse('Wanna start over?')
      client.updateConversationState({
        startOver: true
      })
      console.log('Asking')
      client.done()
    },
  })

  const confirmReset = client.createStep({
    satisfied() {
      return true
    },

    prompt() {
      client.updateConversationState({
        gotYes: true
      })
      console.log('They said yes')
      client.done()
    },
  })

  const resetConvo = client.createStep({
    satisfied() {
      return (!Boolean(client.getConversationState().query) && !Boolean(client.getConversationState().near))
    },

    prompt() {
      if (client.getConversationState().startOver) {
        client.addTextResponse(`Let's try again.  How can I help?`)
        client.updateConversationState({
          query: '',
          near: '',
          startOver: false,
        })
        console.log('Resetting')
      }
      client.done()
    },
  })

  client.runFlow({
    classifications: {
      'greeting': 'hi',
      'request/venues': 'getVenues',
      'provide/near_place': 'getVenues',
      'goodbye': 'ask',
      'affirmative': 'reset',
    },
    streams: {
      main: 'getVenues',
      hi: [sayHello],
      getVenues: [collectQuery, collectNear, provideVenues],
      ask: [askForConfirmation],
      reset: [confirmReset, resetConvo]
    }
  })
}
