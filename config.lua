local EssenceTable = {
    [0] = 0.00380, -- 0 - 3
    [3] = 0.300, -- 3 - 30
    [30] = 0.00270, -- 3 - 41
    [41] = 0.00200,
    [51] = 0.00140,
    [55] = 0.00110,
    [61] = 0.00080,
    [71] = 0.00055,
    [81] = 0.00065,
    [91] = 0.00075,
    [110] = 0.00100,
    [120] = 0.00150,
    [130] = 0.00200,
    [140] = 0.00250,
    [150] = 0.00300,
    [160] = 0.00380,
    [170] = 0.00460,
    [180] = 0.00500,
}

-- local EssenceTable = {
--     [0] = 0.00001, -- 0 - 3
--     [3] = 0.00004, -- 3 - 30
--     [30] = 0.00006, -- 3 - 41
--     [41] = 0.00010,
--     [51] = 0.00025,
--     [55] = 0.00035,
--     [61] = 0.00045,
--     [71] = 0.00055,
--     [81] = 0.00065,
--     [91] = 0.00075,
--     [110] = 0.00100,
--     [120] = 0.00150,
--     [130] = 0.00200,
--     [140] = 0.00250,
--     [150] = 0.00300,
--     [160] = 0.00380,
--     [170] = 0.00460,
--     [180] = 0.00500,
-- }

local MinFuelForDegrade = 0.5; -- при цій кількості топлива, транспорт почне зменшувати максимальну швидкість

AddEventHandler("UnityFuel::RequestConfig", function()
    TriggerEvent("UnityFuel::Config", {
        EssenceTable = EssenceTable,
    })
end)

RegisterServerEvent("UnityFuel::RequestClientConfig", function()
    TriggerClientEvent("UnityFuel::ClientConfig", source, {
        MinFuelForDegrade = MinFuelForDegrade,
    })
end);