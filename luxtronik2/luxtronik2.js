/**
 *      CCU.IO Luxtronik2 0.9.0
 *      (C) Frank Motzkau
 */

/* common code */
var debug = true;   // set true for more debugging info

var settings = require(__dirname+'/../../settings.js');

if (!settings.adapters.luxtronik2 || !settings.adapters.luxtronik2.enabled)
{
    process.exit();
}

var io = require('socket.io-client');
var logger = require(__dirname+'/../../logger.js');
var socket;
if (settings.ioListenPort)
{
    socket = io.connect("127.0.0.1",
    {
        port: settings.ioListenPort
    });
}
else if (settings.ioListenPortSsl)
{
    socket = io.connect("127.0.0.1",
    {
        port: settings.ioListenPortSsl,
        secure: true
    });
}
else
{
    process.exit();
}

socket.on('connect', function ()
{
    dbgout("adapter luxtronik2 connected to ccu.io");
});

socket.on('disconnect', function ()
{
    dbgout("adapter luxtronik2 disconnected from ccu.io");
});

function stop()
{
    dbgout("adapter luxtronik2 terminating");
    setTimeout(function ()
    {
        process.exit();
    }, 250);
}

process.on('SIGINT', function ()
{
    stop();
});

process.on('SIGTERM', function ()
{
    stop();
});

// ------------------------------------------
// get rega objects
// ------------------------------------------
var metaObjects = {};
var metaIndex = {};
var dataLoaded = false;

socket.emit('getObjects', function(objects)
{
    dbgout("adapter luxtronik2 fetched metaObjects from ccu.io");
    metaObjects = objects;
    socket.emit('getIndex', function(objIndex)
    {
        dbgout("adapter luxtronik2 fetched metaIndex from ccu.io");
        metaIndex = objIndex;
        dataLoaded = true;
        luxtronikConnect();
    });
});

// ------------------------------------------
// debugging
// ------------------------------------------
function dbgout(log)
{
    if (debug)
    {
        logger.info(log);
        console.log(log);
    }
}

// ------------------------------------------
// tools
// ------------------------------------------
function setState(id, val)
{
    socket.emit("setState", [id,val]);
}

function setObject(id, obj)
{
    metaObjects[id] = obj;

    if (obj.Value)
    {
        metaIndex.Address[obj.Name] = obj.Value;
    }

    socket.emit("setObject", id, obj);
}

// ------------------------------------------
// Luxtronik2
// ------------------------------------------
var net = require('net');
var fs = require('fs');
var buffer = require('buffer');
var binary = require('binary');

/*
 INDEX : { "name": FRIENDLY_NAME, "type": TYPE[, "enum": ENUM_VALUES] }

 INDEX - numeric index in luxtronik response
 FRIENDLY_NAME - shows meaning of channel; used as MYSQL column name
 TYPE - how to translate the value
 "ignore" - do not use this value
 "fix1" - has one decimal place (must divide by 10)
 "ip" - IPv4 address
 "unixtime" - unix timestamp (seconds since 01.01.1970) as ISO string
 "timestamp" - leave as int32 but creates TIMESTAMP column in mysql
 "enum" - use ENUM_VALUES to translate (value is index)
 undefined - use value unchanged (as int32)

 if index is not found here, we use name = index; type = undefined

 channel translation source: http://sourceforge.net/projects/opendta/
 */
var channellist = require(__dirname+'/channellist.json');
var tools = require(__dirname+'/tools.js');

var luxSettings = settings.adapters.luxtronik2.settings;

function luxtronikConnect()
{
    var client;
    if (tools.isset(luxSettings.mysql))
    {
        client = dbConnection();
    }

    var luxInit = require(__dirname+'/init.js');
    luxInit.initChannels(channellist, settings.adapters.luxtronik2.firstId);
    // init rega objects if not exists
    //if (!metaObjects[settings.adapters.luxtronik2.firstId])
    {
        luxInit.initRega(channellist, socket, settings.adapters.luxtronik2.firstId);
        if (client)
        {
            // init database
            luxInit.initDatabase(channellist, client, luxSettings.mysql.database)
        }
    }

    /* make connection with Luxtronik */
    var luxsock = net.connect({host:luxSettings.host, port: luxSettings.port});

    /* handle error */
    luxsock.on("error", function (data)
    {
        logger.error('adapter luxtronik2 ' + data.toString());
        console.error(data.toString());
        stop();
    });

    /* handle timeout */
    luxsock.on("timeout", function ()
    {
        logger.warn('adapter luxtronik2 connection timeout');
        console.warn("client timeout event");
        stop();
    });

    /* handle close */
    luxsock.on("close", function ()
    {
        dbgout("client close event");
        stop();
    });

    /* handle end */
    luxsock.on('end', function ()
    {
        dbgout("client end event");
        stop();
    });

    /* receive data */
    luxsock.on('data', function(data)
    {
        var buf = new Buffer(data.length);
        buf.write(data, 'binary');
		/* luxtronik must confirm command */
        var confirm = buf.readUInt32BE(0);
		/* is 0 if data is unchanged since last request */
        var change = buf.readUInt32BE(4);
		/* number of values */
        var count = buf.readUInt32BE(8);

        if (confirm != 3004)
        {
            logger.warn('luxtronik2: command not confirmed');
            stop();
        }
        else if (data.length==count*4+12)
        {
            var pos = 12;
            var calculated = new Int32Array(count);
            for (var i=0;i<count;i++)
            {
                calculated[i] = buf.readInt32BE(pos);
                pos+=4;
            }

			var items = translate(calculated);
            if (client)
            {
    			storeDatabase(client, items);
            }
        }
        luxsock.end();
    });

    // connected => get values
    luxsock.on('connect', function()
    {
        luxsock.setNoDelay(true);
        luxsock.setEncoding('binary');

        var buf = new Buffer(4);
        buf.writeUInt32BE(3004,0);
        luxsock.write(buf.toString('binary'), 'binary');
        buf.writeUInt32BE(0,0);
        luxsock.write(buf.toString('binary'), 'binary');
    });
}

// translate dword to data type
function translate(c)
{
    var result = [];
    for (var i=0;i< c.length; i++)
    {
        if (tools.isset(channellist[i]))
        {
			var value = c[i];
            if (tools.isset(channellist[i].type))
            {
                switch (channellist[i].type)
                {
                    case 'fix1':
                        value /= 10;
                        break;
                    case 'ip':
                        value = tools.int2ip(value);
                        break;
                    case 'unixtime':
                        value = new Date(value * 1000).toISOString();
                        break;
                    case 'timestamp':
                        /* do nothing here, used for mysql table creation */
                        break;
                    case 'ignore':
                        continue;
                        break;
                    case 'enum':
                        if (tools.isset(channellist[i].enum[c[i]]))
                        {
                            value = channellist[i].enum[c[i]];
                        }
                        break;
                }
            }

            // push to array
			result.push(value);
            // set ccu state
			setState(channellist[i].name, value);
        }
    }

    return result;
}

// connect database
function dbConnection()
{
    var mysql = require('mysql');
    var client = mysql.createConnection(
        {
            host: luxSettings.mysql.host,
            user: luxSettings.mysql.user,
            password: luxSettings.mysql.pass
        });

    client.connect(function(err)
    {
        if (err)
        {
            logger.error("adapter luxtronik2 can't connect to mysql-server "+err);
            stop();
        }
        dbgout("adapter luxtronik2 connected to mysql-server on "+settings.adapters.mysql.settings.host);
    });

	return client;
}

// store data in database
function storeDatabase(client, c)
{
    client.query('USE '+luxSettings.mysql.database);

    // add unix timestamp
    var sql = "INSERT INTO luxtronik VALUES ("+Math.round(new Date().getTime() / 1000)+",";
    for (var i=0; i<c.length; i++)
    {
        if (i > 0)
        {
            sql+=',';
        }
        sql = sql+"'"+c[i]+"'";
    }

    sql +=')';
    client.query(sql);
    // that's all
    client.end();
}
