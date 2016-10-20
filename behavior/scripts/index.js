'use strict'

const getVenues = require('./lib/getVenues')
const similarVenues = require('./lib/getSimilarVenues')
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
      client.addTextResponse('Welcome to Foursquare!  I can help you find places like restaurants and other venues and explore areas.  What are you looking for?')
      client.updateConversationState({
        helloSent: true
      })
      client.done()
    }
  })


  const collectNear = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().near)
    },

    extractInfo() {
      var postbackData = client.getPostbackData()

      if (postbackData == null) {
        const place = firstOfEntityRole(client.getMessagePart(), 'place')
        if (place) {
          client.updateConversationState({
            near: place,
            convertedNear: null,
          })
          console.log('User wants venues near:', place.value)
        }
      }
    },

    prompt() {
      client.addResponse('app:response:name:prompt/near_place')
      client.done()
    },
  })


  const confirmNear = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().convertedNear)
    },

    extractInfo() {
      let baseClassification = client.getMessagePart().classification.base_type.value
      if (baseClassification === 'decline') {
        client.updateConversationState({
          near: null,
          convertedNear: false,
        })
        return 'init.proceed' // `next` from this step will get called
      }

      var postbackData = client.getPostbackData()

      if (postbackData != null) {
        client.updateConversationState({
          near: {
            value: postbackData.latlon,
            raw_value: client.getConversationState().near.raw_value,
            canonicalized: client.getConversationState().near.canonicalized,
            parsed: client.getConversationState().near.parsed,
          },
          convertedNear: true,
        })
      }
    },

    prompt(callback) {
      if (client.getConversationState().near != null) {
        getLatLong(client.getConversationState().near.value, (resultBody) => {
          if (!resultBody || resultBody.statusCode !== 200) {
            console.log('Error getting lat/lon.')
            client.updateConversationState({
              convertedNear: false,
            })
            callback()
          } else {
            var carouselArray = []
            var resultLen = 10
            if (resultBody.resourceSets[0].resources.length < 10) {
              resultLen = resultBody.resourceSets[0].resources.length
            }
            for (var i = 0; i < resultLen; i++) {
              var  carouselItemData = {
                'media_url': 'http://maps.google.com/maps/api/staticmap?zoom=12&size=400x400&maptype=road&markers='+resultBody.resourceSets[0].resources[i].point.coordinates[0].toString()+','+resultBody.resourceSets[0].resources[i].point.coordinates[1].toString()+'&sensor=false',
                'media_type': 'image/png', 
                'description': '',
                title: resultBody.resourceSets[0].resources[i].name,
                actions: [
                  {
                    type: 'postback',
                    text: 'Select location',
                    payload: {
                      data: {
                        action: 'select',
                        latlon: resultBody.resourceSets[0].resources[i].point.coordinates[0].toString()+','+resultBody.resourceSets[0].resources[i].point.coordinates[1].toString(),
                      },
                      version: '1',
                      stream: 'getVenues',
                    },
                  },
                ],
              }
              carouselArray.push(carouselItemData)
            }
            if (carouselArray.length > 0) {
              client.addTextResponse('Are you looking in one of these places? Just checking.')
              client.addCarouselListResponse({ items: carouselArray })
            } else {
              client.addTextResponse(`We're having a hard time finding that location.  Could you clarify?`)
            }
            client.done()
            callback()
          }
        })
      } 
    }
  })

  const collectQuery = client.createStep({
    satisfied() {
      return Boolean(client.getConversationState().query)
    },

    extractInfo() {
      var postbackData = client.getPostbackData()

      if (postbackData == null) {
        const type = firstOfEntityRole(client.getMessagePart(), 'type')
        if (type) {
          client.updateConversationState({
            query: type,
          })
          console.log('User wants:', type.value)
        }
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

    extractInfo() {
    },

    prompt(callback) {
      getVenues(client.getConversationState().query.value, client.getConversationState().near.value, client.getConversationState().convertedNear, resultBody => {
        if (!resultBody || resultBody.meta.code !== 200) {
          console.log('Error getting venues.')
          callback()
          return
        }

        var resultLen = resultBody.response.groups[0].items.length
        var carouselArray = []
        var i = 0
        var u = 'https://google.com'
        for (i = 0; i < resultLen; i++) {
          if (resultBody.response.groups[0].items[i].venue.url) {
            u = resultBody.response.groups[0].items[i].venue.url
          }
          var image_link = 'https://foursquare.com'+resultBody.response.groups[0].items[i].venue.categories[0].icon.prefix.slice(20,resultBody.response.groups[0].items[i].venue.categories[0].icon.prefix.length)+'bg_88'+resultBody.response.groups[0].items[i].venue.categories[0].icon.suffix
          console.log(image_link)
          var  carouselItemData = {
            'media_url': image_link,
            'media_type': 'image/png', 
            'description': resultBody.response.groups[0].items[i].venue.location.formattedAddress.join(", "),
            title: resultBody.response.groups[0].items[i].venue.name.slice(0,78),
            actions: [
              {
                type: 'link',
                text: 'Visit page',
                uri: u,
              },
              {
                type: 'postback',
                text: 'Similar venues',
                payload: {
                  data: {
                    action: 'similar',
                    venue_id: resultBody.response.groups[0].items[i].venue.id,
                    venue_name: resultBody.response.groups[0].items[i].venue.name.slice(0,78),
                  },
                  version: '1',
                  stream: 'similarVenues',
                },
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
        if (carouselArray.length > 0) {
          client.addResponse('app:response:name:provide/venues', queryData)
          client.addCarouselListResponse({ items: carouselArray })
        } else {
          client.addTextResponse(`We didn't find anything :/`)
        }
        client.done()
        callback()
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
      return Boolean(!(client.getConversationState().gotYes == null))
    },

    extractInfo() {
      console.log("IN CONFRIMRESET")
      let baseClassification = client.getMessagePart().classification.base_type.value
      console.log(baseClassification)
      if (baseClassification === 'affirmative') {
        console.log('got a yes')
        client.updateConversationState({
          gotYes: true,
        })
      } else if (baseClassification === 'decline') {
        console.log('got a no')
        client.updateConversationState({
          gotYes: false,
        })
      }
    },
  })

  const resetConvo = client.createStep({
    satisfied() {
      return (!Boolean(client.getConversationState().query) && !Boolean(client.getConversationState().near))
    },

    prompt() {
      if (client.getConversationState().startOver && client.getConversationState().gotYes) {
        client.addTextResponse(`Let's try again.  How can I help?`)
      } else {
        client.addTextResponse('Okay, bye!')
      }
      client.updateConversationState({
        query: null,
        near: null,
        startOver: null,
        gotYes: null,
        convertedNear: null,
      })
      console.log('Resetting')
      client.done()
    },
  })

  const provideSimilar = client.createStep({
    satisfied() {
      return false
    },

    
    extractInfo() {
      var postbackData = client.getPostbackData()
      if (postbackData != null) {
        client.updateConversationState({
          similarId: postbackData.venue_id,
          similarName: postbackData.venue_name,
          wantSimilar: true,
        })
      }
    },
 

    prompt(callback) {
      similarVenues(client.getConversationState().similarId, resultBody => {
        if (!resultBody || resultBody.meta.code !== 200) {
          console.log('Error getting similar venues.')
          callback()
          return
        }

        var resultLen = resultBody.response.similarVenues.count
        var carouselArray = []
        var i = 0
        var u = 'https://google.com'
        for (i = 0; i < resultLen; i++) {
          if (resultBody.response.similarVenues.items[i].url) {
            u = resultBody.response.similarVenues.items[i].url
          }
          var image_link = 'https://foursquare.com'+resultBody.response.similarVenues.items[i].categories[0].icon.prefix.slice(20,resultBody.response.similarVenues.items[i].categories[0].icon.prefix.length)+'bg_88'+resultBody.response.similarVenues.items[i].categories[0].icon.suffix
          console.log(image_link)
          var  carouselItemData = {
            'media_url': image_link,
            'media_type': 'image/png', 
            'description': resultBody.response.similarVenues.items[i].location.formattedAddress.join(", "),
            title: resultBody.response.similarVenues.items[i].name.slice(0,78),
            actions: [
              {
                type: 'link',
                text: 'Visit page',
                uri: u,
              },
              {
                type: 'postback',
                text: 'Similar venues',
                payload: {
                  data: {
                    action: 'similar',
                    venue_id: resultBody.response.similarVenues.items[i].id,
                    venue_name: resultBody.response.similarVenues.items[i].name.slice(0,78),
                  },
                  version: '1',
                  stream: 'similarVenues',
                },
              },
            ],
          }
          carouselArray.push(carouselItemData)
        }

        console.log('sending similar venues:', carouselArray)

        if (carouselArray.length > 0) {
          client.addTextResponse('Here are some places similar to '+client.getConversationState().similarName+':')
          client.addCarouselListResponse({ items: carouselArray })
        } else {
          client.addTextResponse(`We didn't find anything :/`)
        }
        client.done()

        callback()
      })
      console.log('User wants venues similar to:', client.getConversationState().similarId)
    },
  })

  client.runFlow({
    classifications: {
      'greeting': 'hi',
      'request/venues': 'getVenues',
      'provide/near_place': 'getVenues',
      'goodbye': 'reset',
      'decline': 'reset',
      'affirmative': 'reset',
      'ask/capabilities': 'provideCapabilities',
    },
    streams: {
      main: 'getVenues',
      hi: [sayHello],
      getVenues: [collectQuery, collectNear, confirmNear, provideVenues],
      ask: [askForConfirmation],
      reset: [askForConfirmation, confirmReset, resetConvo],
      similarVenues: [provideSimilar],
    }
  })
}
