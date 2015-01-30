package com.jadn.cc.test;

import dk.au.cs.thor.robotium2espresso.Solo;
import android.test.ActivityInstrumentationTestCase2;
import android.widget.ListView;

import com.jadn.cc.ui.CarCast;

public class DeleteListenedToTest extends ActivityInstrumentationTestCase2<CarCast> {
	private Solo solo;

	public DeleteListenedToTest() {
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


    /**
     * CQA: The statement solo.waitForText(" COMPLETED ", 1, 10 * 1000)
     * fails if no WIFI is enabled, because a dialog is opened when clicking
     * "Start Downloads", and no download is started until confirmation has
     * been given.
     */
    public void testDeleteListenedTo() throws Exception {
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Settings");
		solo.clickOnText("Max downloads");
		solo.clickOnText("2");
		solo.goBack();
		
		solo.sendKey(Solo.MENU);
		Thread.sleep(500);
		solo.clickOnText("Subscriptions");
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Delete All");
        solo.waitForDialogToOpen(3000);
		solo.clickOnButton("Delete");
        solo.waitForDialogToClose(3000);
		assertEquals(0, solo.getCurrentViews(ListView.class).get(0).getAdapter()
				.getCount());
		// add in fakefeed cast
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Add");
		solo.enterText(0, "cs.au.dk/~cqa/Android/Car-Cast/podcast.xml"); // CQA: jadn.com/cctest/testsub.xml didn't exist
		solo.enterText(1, "testing feed");
		solo.clickOnButton("Save");

		solo.goBack();
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Podcasts");
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Erase");
		solo.clickOnButton("Erase");
		
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Delete All Podcasts");
		solo.clickOnText("Confirm");

		assertTrue(solo.searchText("No podcasts loaded."));

		solo.sendKey(Solo.MENU);
		solo.clickOnText("Download Podcasts");
		solo.clickOnText("Start Downloads");

		// CQA START: Close "WIFI is not connected" dialog
		if (solo.waitForText("WIFI is not connected")) {
			solo.clickOnText("Sure, go ahead");
		}
		// CQA END

		solo.sleep(10 * 1000); // CQA: The 10 * 1000 cannot be ignored in the following waitForText statement
		solo.waitForText(" COMPLETED ", 1, 10 * 1000);

		solo.goBack();
		assertTrue(solo.searchText("1/2"));
		
		solo.clickOnImageButton(1);
		// let both mp3 files play.
		Thread.sleep(10*1000);
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Podcasts");
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Delete Listened To");
		solo.goBack();
		assertTrue(solo.searchText("1/1"));
	}
}