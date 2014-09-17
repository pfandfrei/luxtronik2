exports.int2ip = function (v)
{
    var part1 = v & 255;
    var part2 = ((v >> 8) & 255);
    var part3 = ((v >> 16) & 255);
    var part4 = ((v >> 24) & 255);

    return part4 + "." + part3 + "." + part2 + "." + part1;
}

exports.isset = function (v)
{
    return (typeof v) != 'undefined';
}