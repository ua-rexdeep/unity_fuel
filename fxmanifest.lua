fx_version 'cerulean'
resource_manifest_version '44febabe-d386-4d18-afbe-5e627f4af937'

author "ReXDeep"

games { 'gta5' }


client_scripts {
    'dist/client.js'
}
  
server_scripts {
    "@vrp/lib/utils.lua",
    'dist/server.js'
}