fx_version 'cerulean'
resource_manifest_version '44febabe-d386-4d18-afbe-5e627f4af937'

author "ReXDeep"

games { 'gta5' }
dependency "propInteraction"

client_scripts {
    'dist/client.js'
}

server_scripts {
    'config/essence.lua',
    'config/vehicles.lua',
    'config/pumps.lua',
    'config/script.lua',

    'dist/server.js'
}


files {
    "src/ui/*",
}
ui_page "src/ui/index.html"
