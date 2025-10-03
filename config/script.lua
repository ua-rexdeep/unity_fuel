AddEventHandler("UnityFuel::RequestConfig", function()
    TriggerEvent("UnityFuel::Config", {
        EssenceTable = EssenceTable,
        VehicleClassesData = VehicleClassesData,
        IndividualVehicleData = IndividualVehicleData,
        PumpsReplaceData = PumpsReplaceData,
        ElecticPumpSpawnLocations = ElecticPumpSpawnLocations,
    })
end)

RegisterServerEvent("UnityFuel::RequestVehicleIndividualConfig")
--- @param modelHash number
AddEventHandler("UnityFuel::RequestVehicleIndividualConfig", function(modelHash)
    local cfg, modelName;
    for keyname, data in pairs(IndividualVehicleData) do
        if GetHashKey(keyname) == modelHash then
            cfg = data;
            break;
        end
    end
    print(string.format("[UnityFuel - RequestVehicleIndividualConfig] ModelHash(%s) - %s", modelHash, json.encode(cfg)))
    TriggerClientEvent("UnityFuel::ClientConfig", source, {
        modelName = modelName,
        modelHash = modelHash,
        config = cfg,
    })
end)

-- ! Проблема: слишком большой конфиг
-- TODO: Переделать под запрос настроек отдельного транспорта по требованию.
-- Временное решение: выдать клиенту доступ к vehicles.lua
-- RegisterServerEvent("UnityFuel::RequestClientConfig", function()
--     TriggerClientEvent("UnityFuel::ClientConfig", source, {
--         MinFuelForDegrade = MinFuelForDegrade,
--         IndividualVehicleData = IndividualVehicleData,
--     })
-- end);
