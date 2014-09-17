var channeltype;
var tools = require(__dirname+'/tools.js');

// init channellist object
exports.initChannels = function(channellist, firstId)
{
    channeltype = require(__dirname+'/channeltype.json');

    var chnTypeKeys = Object.keys(channeltype);
    for (var i=0; i<chnTypeKeys.length; i++)
    {
        channeltype[chnTypeKeys[i]].id = firstId + 1 + i;
    }

    var count = Object.keys(channellist).length;
    for (var i=0; i<count; i++)
    {
        if (tools.isset(channellist[i]) &&
            tools.isset(channellist[i].dp))
        {
            /* channellist settings can overwrite default unit */
            if (tools.isset(channellist[i].unit))
            {
                channellist[i].unit = channeltype[channellist[i].dp].unit;
            }

            if (tools.isset(channellist[i].valtype))
            {
                channellist[i].valtype = channeltype[channellist[i].dp].valtype;
            }

            channellist[i].id = firstId + 20 + i;
            channellist[i].parentid = channeltype[channellist[i].dp].id;
        }
    }
}

// init rega objects
exports.initRega = function(channellist, socket, firstId)
{
    socket.emit("setObject", firstId, {
        Name: "luxtronik2",
        TypeName: "DEVICE",
        HssType: "LUX",
        Address: "luxtronik2",
        Interface: "CCU.IO",
        Channels: [
            firstId + 1
        ]
        //,_persistent: true
    });

    var chnTypeKeys = Object.keys(channeltype);
    for (var i=0; i<chnTypeKeys.length; i++)
    {
        socket.emit("setObject", channeltype[chnTypeKeys[i]].id,
            {
                Name: "luxtronik2",
                TypeName: "CHANNEL",
                Address: "luxtronik2",
                HssType: chnTypeKeys[i],
                Parent: firstId
                //,_persistent: true
            });
    }

    var count = Object.keys(channellist).length;
    for (var i=0; i<count; i++)
    {
        if (tools.isset(channellist[i].id))
        {
            socket.emit("setObject", channellist[i].id,
            {
                Name: channellist[i].name,
                DPInfo: channellist[i].dp,
                TypeName: "VARDP",
                ValueMin: null,
                ValueMax: null,
                ValueUnit: channellist[i].unit,
                ValueType: channellist[i].valtype,
                Parent: channellist[i].parentid
                //,_persistent: true
            });
        }
    }
}

// init mysql database
exports.initDatabase = function (channellist, client, database)
{
    // not in channellist.json declared channels are ignored
    var fields = [];
    var count = Object.keys(channellist).length;
    for (var i=0;i<count; i++)
    {
        if (typeof(channellist[i]) != 'undefined')
        {
            var type;
            switch (channellist[i].type)
            {
                case 'fix1':
                    type = 'FLOAT';
                    break;
                case 'ip':
                    type = 'VARCHAR(15)';
                    break;
                case 'unixtime':
                    type ='DATETIME';
                    break;
                case 'enum':
                    type = 'VARCHAR(32)';
                    break;
                case 'timestamp':
                    type ='TIMESTAMP';
                    break;
                case 'ignore':
                    continue;
                    break;
                default:
                    type = 'INT(11)';
                    break;
            }

            fields.push("`"+channellist[i].name+"` "+type+" NOT NULL");
        }
    }

    client.query("CREATE DATABASE IF NOT EXISTS "+ database);

    client.query("USE "+database);
    var sql = "CREATE TABLE IF NOT EXISTS `luxtronik` (`timestamp` BIGINT(20) NOT NULL," +fields.join(',')+", PRIMARY KEY (`timestamp`)) CHARSET=utf8;";
    client.query(sql);
}