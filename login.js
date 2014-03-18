/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function doLogin(res, req, crypto, connection, tokenSeed, eventLog) {
    var mail = req.params.mail;
    var pass = req.params.pass;
    var ip = req.connection.remoteAddress;
    connection.query('SELECT id, name, token FROM user WHERE password = ' + connection.escape(pass) + ' AND email = ' + connection.escape(mail), function(err, result) {
        //console.log(result[0].token + " " + mail + " " + pass); //used for debugging 
        res.type('application/json');
        if (err) {
            res.json({result: 'DATABASE_ERROR'});
            eventLog('[ Database error on login from ' + ip + ' mail: ' + mail + ' password: ' + pass + ' ]');
        }
        else if (result === 'undefined' || result.length === 0) {
            res.json({result: 'AUTH_FAILED'});
            eventLog('[ Authentication failed from ' + ip + ' mail: ' + mail + ' password: ' + pass + ' ]');
        }
        else {
            var hash = crypto.createHash('md5').update(tokenSeed + mail + pass).digest('hex');
            if (result[0].token !== hash) {
                connection.query("UPDATE user SET token = '" + hash + "' WHERE id = " + result[0].id);
                eventLog('[ Token updated for user: ' + result[0].name + ' id: ' + result[0].id + ' ]');
            }
            eventLog('[ user ' + result[0].name + ' id: ' + result[0].id + ' IP: ' + ip + ' successfully logged in ]');
            res.json({result: 'OK', token: hash, id: result[0].id, name: result[0].name});
        }
    });
}

module.exports.doLogin = doLogin;
