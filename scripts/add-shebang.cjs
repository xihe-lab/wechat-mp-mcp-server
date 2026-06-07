const fs = require('fs')
const f = 'dist/index.js'
let c = fs.readFileSync(f, 'utf8')
if (!c.startsWith('#!')) {
  fs.writeFileSync(f, '#!/usr/bin/env node\n' + c)
}
