/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function checkSendRegister(req, res, connection, eventLog, transport) {
    var mailAddress = req.body.mail;
    var name = req.body.name;
    var pass = req.body.pass;
    var ip = req.connection.remoteAddress;
    connection.query('SELECT id FROM user WHERE email = ' + connection.escape(mailAddress), function(err, result) {
        res.type('application/json');
        if (err) {
            res.json({result: 'DATABASE_ERROR'});
            eventLog('[ Database error on email checking request from ' + ip + ' mail: ' + mailAddress + ' ]');
        }
        else if (result.length >= 1) {
            res.json({result: 'EMAIL_EXISTS_ERROR'});
            eventLog('[ Mail address already in the DB  request from ' + ip + ' mail: ' + mailAddress + ' ]');
        }
        else if (result.length === 0) {
            connection.query('INSERT INTO user (email, name, password) VALUES (' + connection.escape(mailAddress) + ', ' + connection.escape(name) + ', ' + connection.escape(pass) + ')', function(err, insertResult) {
                if (err) {
                    res.json({result: 'DATABASE_ERROR'});
                    eventLog('[ Database error on inserting new user from ' + ip + ' mail: ' + mailAddress + ' ]');
                }
                else {
                    var code = Math.floor((Math.random() * 10000) + 1);
                    var mailOptions = {
                        from: "CollabRoute <noreply.collabroute@gmail.com>",
                        to: name + " <" + mailAddress + ">",
                        subject: "CollabRoute registration confirm",
                        html: "<h2>WELCOME " + name + "!</h2>" +
                                "<h4>Just a few minutes and you will complete your registration</h4>" +
                                "<p>go back to the app and insert the following code: <strong>" + code + "</strong></p>"
                    };
                    transport.sendMail(mailOptions, function(err, response) {
                        if (err) {
                            eventLog(err);
                            res.json({result: 'EMAIL_SEND_ERROR'});
                            connection.query('DELETE FROM user WHERE email = ' + connection.escape(mailAddress), function(err, res) {
                                if (err) {
                                    eventLog('Possible DB data inconsistency on delete new user with email address '+ mailAddress+' please check it manually error: '+err);
                                }
                            });
                        }else{
                             eventLog("Confirmation mail sent to new user: " + name + " (" + ip + "): " + response.message);
                             res.json({result: 'OK' , code : code});
                        }
                    });
                }
            });
        }
    });
}
module.exports.checkSendRegister = checkSendRegister;

