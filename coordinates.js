/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function updateCoordinates(req, res, connection, eventLog, request, key) {
    var id = req.headers.id;
    var jsonRequest = req.body;
    var long2 = jsonRequest.longitude;
    var lat2 = jsonRequest.latitude;
    if (!validateLatLong(lat2, long2)) {
        res.json({type: "update_coordinates", result: "WRONG_COORDINATES"});
        eventLog("[ Error wrong coordinates from coordinate update request done by user with ID: " + id + " ]");
        return;
    }
    var APIurl = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat2 + ',' + long2 + '&sensor=true&key=' + key;
    request(APIurl, function(err, response, data) {
        if (err) {
            res.json({type: "update_coordinates", result: "GEOCODE_API_ERROR"});
            eventLog("[ Error on reverse geocoding API requested by user with ID: " + id + " ]");
            return;
        }
        data = JSON.parse(data);
        var address;
        if (data.status === "ZERO_RESULTS") {
            address = 'unknown';
        } else {
            address = data.results[0].formatted_address;
        }
        connection.query('UPDATE user SET longitude = ' + connection.escape(long2) +
                ', latitude = ' + connection.escape(lat2) +
                ', address = ' + connection.escape(address) + ' WHERE id = ' + connection.escape(id), function(err) {
            if (err) {
                eventLog('[  Error on update coordinates for user ID: ' + id +
                        ' latitude: ' + lat2 + ' longitude: ' + long2 + ' address: ' + address + ' ]');
                res.json({type: "update_coordinates", result: "DATABASE_ERROR"});
                return;
            }
            //eventLog('[ successfully coordinates updated from user ID: ' + id + ' Lat: ' + lat2 + ' Long: ' + long2 + ' address: ' + address + ']');
            res.json({type: "update_coordinates", result: "OK", latitude: lat2, longitude: long2, address: address});
            return;
        });
    });

}

function validateLatLong(lat, long) {
    if (!isNumeric(lat) || !isNumeric(long))
        return false;
    if (lat < -90 || lat > 90)
        return false;
    if (long < -180 || long > 180)
        return false;
    return true;
}

function isNumeric(n) {
    return !isNaN(parseFloat(n) && isFinite(n));
}

module.exports.updateCoordinates = updateCoordinates;