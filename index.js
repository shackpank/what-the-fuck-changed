var async = require('async');
var exec = require('child_process').exec;
var moment = require('moment');

exec('npm ls --json', {
  maxBuffer: Infinity
}, function(e, json) {
  var data = JSON.parse(json);
  var flat = _flattenDependencies(data.dependencies);
  var total = flat.length;
  var completed = 0;

  async.mapLimit(flat, 50, function(item, callback) {
    var progress = (completed / total) * 100;
    console.log('lookup', _pad(item.name, 60), progress.toFixed(2), '%');

    exec('npm info ' + item.name + ' --json', function(e, json) {
      completed++;

      try {
        var data = JSON.parse(json);
      } catch(except) {
        // It was probably a git dep that doesn't exist in the
        // registry.
        console.log(item.name, json);
        item.released = new Date('1000-01-01');
        return callback(null, item);
      }

      var releaseDate = data.time[item.version];
      if (!releaseDate) {
        // This git dep has the same name as a module in the registry.
        console.log(item.name, data, item.version);
        item.released = new Date('1000-01-01');
        return callback(null, item);
      }

      item.released = new Date(releaseDate);
      callback(null, item);
    });
  },

  function(err, res) {
    res = res.sort(function(a, b) {
      return a.released < b.released ? -1 : 1;
    }).map(function(f) {
      var date = moment(f.released).format('YYYY-MM-DD HH:mm');
      var versionDescriptor = f.version;
      var moduleName = f.name;

      moduleName = _pad(moduleName, 60);
      versionDescriptor = _pad(versionDescriptor, 15);

      return moduleName + '@ ' + versionDescriptor + date;
    });

    console.log(res.join('\n'));
  });
});

_flattenDependencies = function(obj, stack) {
  stack = stack || [];
  var deps = [];

  Object.keys(obj).forEach(function(key) {
    if(obj[key].dependencies) {
      deps = deps.concat(_flattenDependencies(obj[key].dependencies, stack.concat(key)));
    }

    if(!obj[key].version) {
      if(obj[key].missing || !Object.keys(obj[key]).length) {
        return;
      }
      console.log(obj[key], obj, stack);
      throw 'No version for ' + key;
    }

    deps.push({
      name: key,
      version: obj[key].version
    });
  });

  return deps;
};

_pad = function(s, l) {
  while(s.length < l) s += ' ';
  return s;
};
