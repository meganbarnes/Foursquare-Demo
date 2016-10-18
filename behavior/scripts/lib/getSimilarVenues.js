'use strict'

const request = require('request')

module.exports = function getVenues(query, next) {
  const clientId = `XQYDBEOP3W2VPGRIB3FE13LY5XV5M2E20Y4W20P0VUPVKXP0`
  const clientSecret = `HX5M5PBDQJJ0V03CSHRWU2YEMVOZJLOR3NKMNQQPFSTI5LYS`
  const v = `20161010`

  var requestUrl = `https://api.foursquare.com/v2/venues/${query}/similar?client_id=${clientId}&client_secret=${clientSecret}&v=${v}`

  console.log('Making HTTP GET request to:', requestUrl)

  request(requestUrl, (err, res, body) => {
    if (err) {
      throw new Error(err)
    }

    if (body) {
      const parsedResult = JSON.parse(body)
      next(parsedResult)
    } else {
      next()
    }
  })
}