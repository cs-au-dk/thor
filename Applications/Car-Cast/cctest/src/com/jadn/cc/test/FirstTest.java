package com.jadn.cc.test;

import dk.au.cs.thor.robotium2espresso.Solo;
import android.test.ActivityInstrumentationTestCase2;

import com.jadn.cc.ui.CarCast;

public class FirstTest extends ActivityInstrumentationTestCase2<CarCast> {
	private Solo solo;

	public FirstTest() {
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
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Settings");
		solo.isCheckBoxChecked(1);// wifi checkbox
	}
}
