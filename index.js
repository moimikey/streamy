const fs = require('fs')
const {
  Worker, isMainThread, parentPort, workerData
} = require('worker_threads')
const split = require('binary-split')
const meow = require('meow')

function ab2str (buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf))
}

function str2ab (str) {
  let buf = new ArrayBuffer(str.length * 2)
  let bufView = new Uint16Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

const cli = meow(`
	Usage
	  $ streamy <input>

	Options
    --passwords, -p Password list
    --verbose
`, {
	flags: {
    passwords: {
      type: 'string',
      alias: 'p'
    },
    verbose: {
      type: 'boolean',
      default: true
    }
	}
})

if (isMainThread) {
  const fulfillments = []

  const fulfill = () => {
    let threads = 4
    let chunks = toChunks(fulfillments, Math.round(fulfillments.length / threads))
    let chunksLength = chunks.length

    for (let i = 0; i < chunksLength; i++) {
      let worker = new Worker(__filename, { workerData: {
        chunks: chunks[i],
        thread: i
      }})
      worker.on('message', (msg) => {
        console.log("working on: ", msg)
      })
      worker.on('error', console.error)
      worker.on('exit', (code) => {
        if (code != 0) {
          console.error(new Error(`Worker stopped with exit code ${code}`))
        }
      })
    }
  }
  
  const toChunks = (arr, chunkLength) => {
    const chunks = []
    let i, j, chunk
    for (i = 0, j = arr.length; i < j; i += chunkLength) {
      chunk = arr.slice(i, i + chunkLength)
      chunks.push(chunk)
    }
    return chunks
  }
  
  if (!cli.flags.passwords) {
    cli.showHelp()
  }

  fs.createReadStream(cli.flags.passwords)
    .pipe(split())
    .on('data', line => fulfillments.push(line))
    .on('end', fulfill)
    .on('error', () => {
      console.error('Error reading file')
    })
} else {
  const { chunks, thread } = workerData
  console.log('thread', thread)
  chunks.forEach(a => {
    parentPort.postMessage(ab2str(a))
  })
}


