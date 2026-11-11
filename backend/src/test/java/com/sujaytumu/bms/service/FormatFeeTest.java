package com.sujaytumu.bms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class FormatFeeTest {

    @Test
    void feesFollowTheFormat() {
        assertEquals(0, Pricing.formatFee("2D"));
        assertEquals(0, Pricing.formatFee(null));
        assertEquals(40, Pricing.formatFee("3D"));
        assertEquals(60, Pricing.formatFee("Dolby 2D"));
        assertEquals(100, Pricing.formatFee("Dolby 3D"));
        assertEquals(80, Pricing.formatFee("PXL 2D"));
        assertEquals(120, Pricing.formatFee("IMAX 2D"));
        assertEquals(160, Pricing.formatFee("IMAX 3D"));
        assertEquals(150, Pricing.formatFee("4DX 3D"));
    }

    @Test
    void seatPriceAddsTheFeeOnTopOfTheSeatClass() {
        assertEquals(Pricing.seatPrice("MULTIPLEX", "J5"), Pricing.seatPrice("MULTIPLEX", "J5", "2D"));
        assertEquals(150 + 120, Pricing.seatPrice("MULTIPLEX", "J5", "IMAX 2D"));
        assertEquals(450 + 120, Pricing.seatPrice("MULTIPLEX", "A5", "IMAX 2D"));
        assertEquals(100 + 40, Pricing.seatPrice("SINGLE", "H1", "3D"));
    }

    @Test
    void classPricesCarryTheFeeToo() {
        var p = Pricing.classPrices("MULTIPLEX", "Dolby 3D");
        assertEquals(150 + 100, p.get("Dress Class"));
        assertEquals(450 + 100, p.get("Recliner"));
    }
}
