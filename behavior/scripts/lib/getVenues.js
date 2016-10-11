'use strict'

const request = require('request')

module.exports = function getVenues(next) {
  const clientId = `XQYDBEOP3W2VPGRIB3FE13LY5XV5M2E20Y4W20P0VUPVKXP0`
  const clientSecret = `HX5M5PBDQJJ0V03CSHRWU2YEMVOZJLOR3NKMNQQPFSTI5LYS`
  const v = `20161010`

  const requestUrl = `https://api.foursquare.com/v2/venues/search?client_id=${clientId}&client_secret=${clientSecret}&v=${v}&near=crown heights, NY&query=pizza&radius=1000&intent=browse&limit=10`

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