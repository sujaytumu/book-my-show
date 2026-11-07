package com.sujaytumu.bms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ReleaseVariantsTest {

    @Test
    void sameShowAlwaysGetsTheSameLabel() {
        var a = ReleaseVariants.label(4242, "Hyderabad", "PVR LakeShore Mall", "MULTIPLEX", LocalTime.of(19, 0));
        var b = ReleaseVariants.label(4242, "Hyderabad", "PVR LakeShore Mall", "MULTIPLEX", LocalTime.of(19, 0));
        assertEquals(a, b);
    }

    @Test
    void singleScreensPlayTheLocalLanguageInPlain2dMostly3dRarely() {
        int threeD = 0;
        for (long id = 1; id <= 1000; id++) {
            var l = ReleaseVariants.label(id, "Hyderabad", "Sandhya 70MM", "SINGLE", LocalTime.of(18, 30));
            assertEquals("Telugu", l.language());
            assertTrue(l.format().equals("2D") || l.format().equals("3D"));
            if (l.format().equals("3D")) threeD++;
        }
        assertTrue(threeD > 60 && threeD < 200, "about 12% 3D, was " + threeD);
    }

    @Test
    void multiplexesMixLanguagesAndPremiumFormats() {
        Map<String, Integer> langs = new HashMap<>();
        Map<String, Integer> formats = new HashMap<>();
        for (long id = 1; id <= 2000; id++) {
            var l = ReleaseVariants.label(id, "Hyderabad", "Prasads Multiplex", "MULTIPLEX", LocalTime.of(19, 15));
            langs.merge(l.language(), 1, Integer::sum);
            formats.merge(l.format(), 1, Integer::sum);
            assertTrue(l.format().length() <= 10, "fits the format column: " + l.format());
        }
        assertTrue(langs.get("Telugu") > langs.get("Hindi"), "local language leads");
        assertTrue(langs.get("Hindi") > langs.get("Tamil"));
        assertTrue(langs.containsKey("English") && langs.containsKey("Tamil"));
        assertTrue(formats.containsKey("IMAX 2D") && formats.containsKey("IMAX 3D"), "IMAX at Prasads");
        assertTrue(formats.containsKey("2D") && formats.containsKey("3D"));
    }

    @Test
    void localLanguageFollowsTheCity() {
        assertEquals("Tamil", ReleaseVariants.label(7, "Chennai", "Kasi Theatre", "SINGLE", LocalTime.of(10, 0)).language());
        assertEquals("Kannada", ReleaseVariants.label(7, "Bengaluru", "Some Hall", "SINGLE", LocalTime.of(10, 0)).language());
    }
}
