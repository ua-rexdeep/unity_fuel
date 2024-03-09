EssenceTable = {
    [0] = 0.00180, -- 0 - 3
    [3] = 0.0200, -- 3 - 30
    [30] = 0.00220, -- 3 - 41
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
    [180] = 0.00500
}

VehicleClassesData = {
    [0] = { -- Compacts
        essenceMultiplier = 0.7,
        maxFuel = 25,
    },
    [1] = { -- Sedans
        essenceMultiplier = 1.1,
        maxFuel = 38,
    },
    [2] = { -- SUVs
        essenceMultiplier = 1.7,
        maxFuel = 64,
    },
    [3] = { -- Coupes
        essenceMultiplier = 1.1,
        maxFuel = 25,
    },
    [4] = { -- Muscle
        essenceMultiplier = 1.5,
        maxFuel = 55,
    },
    [5] = { -- Sports Classics
        essenceMultiplier = 1.3,
        maxFuel = 55,
    },
    [6] = { -- Sports
        essenceMultiplier = 1.5,
        maxFuel = 55,
    },
    [7] = { -- Super
        essenceMultiplier = 1.5,
        maxFuel = 55,
    },
    [8] = { -- Motorcycles
        essenceMultiplier = 0.6,
        maxFuel = 10,
    },
    [9] = { -- Off-road
        essenceMultiplier = 1.2,
        maxFuel = 64,
    },
    [10] = { -- Industrial
        essenceMultiplier = 1.0,
        maxFuel = 100,
    },
    [11] = { -- Utility
        essenceMultiplier = 1.0,
        maxFuel = 64,
    },
    [12] = { -- Vans
        essenceMultiplier = 1.2,
        maxFuel = 64,
    },
    [14] = { -- Boats
        essenceMultiplier = 1.0,
        maxFuel = 64,
    },
    [15] = { -- Helicopters
        essenceMultiplier = 1.0,
        maxFuel = 200,
    },
    [16] = { -- Planes
        essenceMultiplier = 1.0,
        maxFuel = 200,
    },
    [17] = { -- Service
        essenceMultiplier = 1.0,
        maxFuel = 64,
    },
    [18] = { -- Emergency
        essenceMultiplier = 1.0,
        maxFuel = 64,
    },
    [19] = { -- Military
        essenceMultiplier = 1.9,
        maxFuel = 64,
    },
    [20] = { -- Commercial
        essenceMultiplier = 1.8,
        maxFuel = 64,
    },
};

MinFuelForDegrade = 0.5; -- при цій кількості топлива, транспорт почне зменшувати максимальну швидкість