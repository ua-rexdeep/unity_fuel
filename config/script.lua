AddEventHandler("UnityFuel::RequestConfig", function()
    TriggerEvent("UnityFuel::Config", {
        EssenceTable = EssenceTable,
        VehicleClassesData = VehicleClassesData,
        IndividualVehicleData = IndividualVehicleData,
        PumpsReplaceData = PumpsReplaceData,
        ElecticPumpSpawnLocations = ElecticPumpSpawnLocations,
    })
end)

RegisterServerEvent("UnityFuel::RequestClientConfig", function()
    TriggerClientEvent("UnityFuel::ClientConfig", source, {
        MinFuelForDegrade = MinFuelForDegrade,
        IndividualVehicleData = IndividualVehicleData,
    })
end);