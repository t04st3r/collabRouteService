/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function doLogin(res, req, crypto, connection, eventLog, transport) {
    var mail = req.params.mail;
    var pass = req.params.pass;
    var ip = req.connection.remoteAddress;
    connection.query('SELECT id, name, confirmed FROM user WHERE password = ' + connection.escape(pass) + ' AND email = ' + connection.escape(mail), function(err, result) {
        //console.log(result[0].token + " " + mail + " " + pass); //used for debugging 
        res.type('application/json');
        if (err) {
            res.json({type: 'login', result: 'DATABASE_ERROR'});
            eventLog('[ Database error on login from ' + ip + ' mail: ' + mail + ' password: ' + pass + ' ]');
            return;
        }
        if (result === 'undefined' || result.length === 0) {
            res.json({type: 'login', result: 'AUTH_FAILED'});
            eventLog('[ Authentication failed from ' + ip + ' mail: ' + mail + ' password: ' + pass + ' ]');
            return;
        }
        if (result[0].confirmed !== 1) {
            var code = Math.floor((Math.random() * 10000) + 1);
            code = code < 1000 ? code + 1000 : code;
            connection.query('UPDATE user SET code =' + code + ' WHERE id = ' + result[0].id, function(err) {
                if (err) {
                    res.json({type: 'login', result: 'DATABASE_ERROR'});
                    eventLog('[ Database error on update code from ' + ip + ' mail: ' + mail + ' password: ' + pass + ' ]');
                    return;
                }
            });
            res.json({type: 'login', result: 'USER_NOT_CONFIRMED', code: code});
            sendMail(result[0].name, mail, code, transport);
            eventLog('[ login attempt from not confirmed user: ' + result[0].name + ' ip: ' + ip + ' mail: ' + mail + ' activation mail sent ]');
            return;
        }
        var hash = crypto.createHash('md5').update(Math.random().toString()).digest('hex');
        connection.query("UPDATE user SET token = '" + hash + "' WHERE id = " + result[0].id);
        eventLog('[ Token updated for user: ' + result[0].name + ' id: ' + result[0].id + ' ip: ' + ip + '  token: '+hash+' ]');

        eventLog('[ user ' + result[0].name + ' id: ' + result[0].id + ' IP: ' + ip + ' successfully logged in ]');
        res.json({type: 'login', result: 'OK', token: hash, id: result[0].id, name: result[0].name, mail: mail});
    });
}

function sendMail(name, mail, code, transport) {
    var mailOptions = {
        from: "CollabRoute <noreply.collabroute@gmail.com>",
        to: mail + " <" + mail + ">",
        subject: "CollabRoute account confirm",
        html: "<h2>EHI " + name + "</h2>" +
                "<h4>It seems that your account is not active yet</h4>" +
                "<p>For activating it go back to the app and insert the following code: <strong>" + code + "</strong></p>"
    };
    transport.sendMail(mailOptions);
}

module.exports.doLogin = doLogin;
