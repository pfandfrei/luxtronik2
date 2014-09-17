luxtronik2
==========

CCU.IO adapter for monitoring heat pump with Luxtronik2 (Novelan, Wolf, Alpha Innotec)

=============================================================================================
Disclaimer:
=============================================================================================
!!! Never trust a software developer !!! Always be sure what you are doing!

This software is developed and tested on a Siemens/Novelan SIC-8HE heatpump.
It should work with all Alpha-Innotec luxtronik 2.0 based controller.
Information about luxtronik where mainly extracted from http://opendta.sourceforge.net/
Additional information was extracted from various forum threads.

=============================================================================================
settings.json
=============================================================================================
CCU.IO settings

MySQL table will be created automatically if it is defined in settings and does not exist

    {
      "enabled": true,
      "mode": "periodical",
      "period": 60,
      "firstId": 101000,
      "settings":
      {
        "host": "192.168.2.100",   => ip address of heatpump
        "port": 8888,              => should be always 8888
        "mysql":                   => remove for no mysql database
        {
          "host": "127.0.0.1",     => ip of mysql server
          "user": "USER",          => mysql server user name
          "pass": "PASS",          => mysql server password
          "database": "DATABASE"   => logging database name (table name is luxtronik)
        }
      }
    }

=============================================================================================
luxtronik2.js
=============================================================================================
main module
- general initialisation
- read out luxtronik spot values
- store calculated values in rega and database

=============================================================================================
tools.js
=============================================================================================
helper functions


=============================================================================================
init.js
=============================================================================================
Init data types, rega and mysql database

=============================================================================================
channellist.json
=============================================================================================
This files contains a description of all luxtronik 2.0 channels based on firmware 1.69

channel names and type based on http://opendta.sourceforge.net/
additional channel names where extracted from wp.jar archive of luxtronik

----------------------------------------------------------------------------------------------
data format
----------------------------------------------------------------------------------------------
each channel is described by name, type(, enum) like

    INDEX : { "name": FRIENDLY_NAME, "type": TYPE, "dp": DATAPOINT[, "enum": ENUM_VALUES] }

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
  
  
DATPOINT - sort channels to groups
  - "TEMPERATURE" - all temperatures (usually float (fix1) with unit "°C")
  - "OUTPUT" - output state (usually boolean value, stored as int32)
  - "INPUT" - input state (usually boolean value, stored as int32)
  - "ANALOG" - measure values (usually float (fix1) with unit "mV")
  - "COUNTER" - incremental values (usually a timespan with unit "s")
  - "TIME" - timestamps (usually reported as unix timestamp)
  - "WMZ" - calculated values based on sensor (usually with unit "kWh")
  - "ERROR" - everything belonging to error tracking,
  - "MISC" - everything else which is unknown or not sorted in other categories

=============================================================================================
channeltype.json
=============================================================================================
    "TEMPERATURE", "OUTPUT", "INPUT", "ANALOG", "COUNTER", "TIME", "WMZ", "ERROR", "MISC" - see above
    "valtype" - HM valtype (2=boolean; 4=float; 16=int; 20=string)
    "unit" - default channel unit (can be overwritten for each channel)
