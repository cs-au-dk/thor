package com.jadn.cc.test;

import dk.au.cs.thor.robotium2espresso.Solo;
import android.test.ActivityInstrumentationTestCase2;
import android.widget.ListView;

import com.jadn.cc.ui.CarCast;

public class WSJListenedToTest extends ActivityInstrumentationTestCase2<CarCast> {
	private Solo solo;

	public WSJListenedToTest() {
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

    public void testWSJ() throws Exception {						
		solo.sendKey(Solo.MENU);
		solo.clickOnText("Settings");
		solo.clickOnText("Max downloads");
		solo.clickOnText("2");
		solo.goBack();
		
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
		solo.enterText(0, "feeds.wsjonline.com/wsj/podcast_wall_street_journal_tech_news_briefing");
		solo.enterText(1, "WSJ");
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
	}
}