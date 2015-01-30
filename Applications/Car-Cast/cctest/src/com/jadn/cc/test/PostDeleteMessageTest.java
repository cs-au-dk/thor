package com.jadn.cc.test;

import dk.au.cs.thor.robotium2espresso.Solo;
import android.test.ActivityInstrumentationTestCase2;
import android.widget.ListView;

import com.jadn.cc.ui.CarCast;

public class PostDeleteMessageTest extends ActivityInstrumentationTestCase2<CarCast> {
	private Solo solo;

	public PostDeleteMessageTest() {
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
	 * If you download podcasts, then delete them all, the player screen incorrectly
	 * had the last download results on it. This test verifies that it now
	 * correctly says "No Podcasts"
	 **/
	public void testSubscriptionReset() throws Exception {
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Subscriptions");
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Delete All");
		solo.clickOnButton("Delete");
		assertEquals(0, solo.getCurrentViews(ListView.class).get(0).getAdapter()
				.getCount());
		// add in fakefeed cast
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Add");
		solo.enterText(0, "cs.au.dk/~cqa/Android/Car-Cast/podcast.xml"); // CQA: jadn.com/cctest/testsub.xml didn't exist
		solo.clickOnButton("Test");
		solo.waitForDialogToClose(20000);
		assertEquals("Channel title 1", solo.getEditText(1).getText().toString()); // CQA: Was "NPR: Wait Wait... Don't Tell Me! Podcast" with testsub.xml
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

		solo.sendKey(Solo.MENU);

		solo.clickOnText("Podcasts");
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Delete All Podcasts");
		solo.clickOnText("Confirm");
		assertTrue(solo.searchText("No podcasts loaded."));
	}
}
