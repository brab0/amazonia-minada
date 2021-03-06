import child_process from 'child_process';
import request from 'request';
import fs from 'fs';
import path from 'path';
import extract from 'extract-zip';
import shapefile from 'shapefile';
 
const removeTmp = output => {  
  child_process.spawnSync('rm',[
     '-rf', 
     path.resolve(process.cwd(), output, 'tmp')
  ]);
}

const cpFiles = source => {
  child_process.spawnSync('cp',[
    path.resolve(process.cwd(), source.output, 'tmp', source.unziped_folder, source.shapefile),
    path.resolve(process.cwd(), source.output)
  ]);

 child_process.spawnSync('cp',[
   path.resolve(process.cwd(), source.output, 'tmp', source.unziped_folder, source.dbf),
   path.resolve(process.cwd(), source.output)
  ]);
}

const makeTmp = (output) => {
  child_process.spawnSync('mkdir',[
    path.resolve(process.cwd(), output, 'tmp')
  ]);
}

const download = (uri, output, name) => {
   console.log('Preparing files(1/2) - Downloading files.')
  
   return new Promise((resolve, reject) => {
      request(uri)
         .pipe(fs.createWriteStream(path.resolve(`${output}/tmp/${name}`)))
         .on('close', (err) => {
            if(err) reject(err)

            resolve()
         });
   })   
}

const unzip = (pathfile, zipfile) => {
   console.log('Preparing files(2/2) - Unzipping files.');

   return new Promise((resolve, reject) => {
      extract(path.resolve(process.cwd(), pathfile, 'tmp', zipfile), { 
         dir: path.resolve(process.cwd(), pathfile, 'tmp') 
      }, (err) => {
         if(err) reject(err)

         resolve()
      })
   });
}
      
const read = (path, file, encoding, cb) => {
   console.log(`\nStarting to read file at ${new Date()}`);
   return shapefile.open(
      `${path}/${file}`, 
      (`${path}/${file}`).replace('shp', 'dbf'), 
      { encoding }
   )
   .then(source => source.read()
      .then(function log(result) {
         if (result.done) return;
         
         return cb(result.value)
            .then(() => source.read())
            .then(log)
      }))
   .then(() => console.log(`\nFinished reading at ${new Date()}`))      
   .catch(error => console.error(error.stack));
}

const writeGeoJson = (data, identity) => {
   console.log(`\nStarting to write ${identity} json file at ${new Date()}`);
   
   return new Promise((resolve, reject) => {  
      const tmpPath = path.resolve(process.cwd(), `files/${identity}/${identity}_tmp.json`);
      const defPath = path.resolve(process.cwd(), `files/${identity}/${identity}.json`);

      fs.writeFile(tmpPath, `{"type":"FeatureCollection","features":${JSON.stringify(data)}}`, 
         (err) => {
            if (err) reject(err);
            else {
               child_process.spawnSync('cp',[ tmpPath, defPath ]);
               child_process.spawnSync('rm',[ '-f', tmpPath ]);

               console.log(`Finish writing ${identity} json file at ${new Date()}`);

               resolve();
            }
      });
   });
}

const writeCSV = (data, identity, properties = []) => {
   console.log(`\nStarting to write ${identity} csv file at ${new Date()}`);
   
   return new Promise((resolve, reject) => {
      const tmpPath = path.resolve(process.cwd(), `files/${identity}/${identity}_tmp.csv`);
      const defPath = path.resolve(process.cwd(), `files/${identity}/${identity}.csv`);

      const wstream = fs.createWriteStream(tmpPath);

      wstream.write(`${properties.join(',')}\n`);
      
      data.forEach((d) => {
         const line = properties.map(prop => {
            const item = d.properties[prop];
            
            return item.toString().indexOf(',') > -1 ? `"${item}"` : item;
         }).join(',');

         wstream.write(`${line}\n`);
      })
      
      wstream.end(() => {
         child_process.spawnSync('cp',[ tmpPath, defPath ]);
         child_process.spawnSync('rm',[ '-f', tmpPath ]);
         
         console.log(`Finish writing ${identity} csv file at ${new Date()}`);

         resolve();
      });
   });
}

export {
   removeTmp,
   cpFiles,
   makeTmp,
   download,
   unzip,
   read,
   writeCSV,
   writeGeoJson
 }