package com.jadn.cc.test;

import dk.au.cs.thor.robotium2espresso.Solo;
import android.test.ActivityInstrumentationTestCase2;

import com.jadn.cc.ui.CarCast;

public class SettingsTest extends ActivityInstrumentationTestCase2<CarCast> {
    private Solo solo;

    public SettingsTest() {
        super(CarCast.class);
    }

    @Override
    public void setUp() throws Exception {
        super.setUp(); // CQA
        solo = new Solo(getInstrumentation(), getActivity());
        UtilTest.closeSplash(solo); // CQA
    }

    @Override
    public void tearDown() throws Exception {
        solo.finishOpenedActivities();
        super.tearDown(); // CQA
    }

    public void testPreferenceIsSaved() throws Exception {
        solo.clickOnMenuItem("Settings");
    }
}