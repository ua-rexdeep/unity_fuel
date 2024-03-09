PumpsReplaceData = {
    {
        objects = {'prop_gas_pump_1d', 'prop_gas_pump_1d_1', 'prop_gas_pump_1d_2', 'prop_gas_pump_1d_3'},
        original = { hash = 'prop_gas_pump_1d' },
        replace = {
            { hash = 'prop_gas_pump_1d_1' },
            { hash = 'prop_gas_pump_1d_3' },
        },
        all = { hash = 'prop_gas_pump_1d_2' },
        offsets = { -- відносні координати слотів
            { x = 0, y = -1, z = 0 },
            { x = 0, y = 1, z = 0 },
        },
        slotOffsets = { -- відносні координати, де буде розміщений м'ячик(місце приєднання канату до помпи)
            { x = 0.345, y = -0.22, z = 2.08 },
            { x = -0.346, y = 0.215, z = 2.05 },
        },
        viewDisplays = { -- де гравець може стояти, щоб бачити панель заправки
            { x = 0, y = -2.5, z = 0 },
            { x = 0, y = 2.5, z = 0 },
        }
    },
    {
        objects = {'prop_electro_airunit01', 'prop_electro_airunit02'},
        original = { hash = 'prop_electro_airunit01' },
        replace = {},
        all = { hash = 'prop_electro_airunit02' },
        isElectricOnly = true,
        offsets = { -- відносні координати слотів
            { x = -1, y = 0, z = 0 },
        },
        slotOffsets = { -- відносні координати, де буде розміщений м'ячик(місце приєднання канату до помпи)
            { x = -0.270, y = 0.050, z = 1.15 },
        },
        viewDisplays = { -- де гравець може стояти, щоб бачити панель заправки
            { x = 0, y = -2.5, z = 0 },
        }
    }
}