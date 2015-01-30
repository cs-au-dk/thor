/**
 *  Paintroid: An image manipulation application for Android.
 *  Copyright (C) 2010-2013 The Catrobat Team
 *  (<http://developer.catrobat.org/credits>)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.catrobat.paintroid.test.integration;

import junit.framework.AssertionFailedError;

import org.catrobat.paintroid.PaintroidApplication;
import org.catrobat.paintroid.R;
import org.catrobat.paintroid.test.utils.Utils;
import org.catrobat.paintroid.ui.DrawingSurface;

import android.graphics.Color;
import android.graphics.PointF;
import android.view.KeyEvent;
import android.util.Log;
import dk.au.cs.thor.robotium2espresso.Solo;

public class FullscreenIntegrationTest extends BaseIntegrationTestClass {

	private static final int TOOLBAR_BOTTOM_OFFSET = 20;

	public FullscreenIntegrationTest() throws Exception {
		super();
	}

	@Override
	public void setUp() {
		super.setUp();
		// resetBrush();
		PaintroidApplication.currentTool.changePaintStrokeWidth(500);
	}

	public void testHideToolbar() {
		assertTrue("Waiting for DrawingSurface", mSolo.waitForView(DrawingSurface.class, 1, TIMEOUT));

		switchToFullscreen();

		PointF screenPoint = new PointF(mScreenWidth / 2, 10);
		// not converting screen point to surface point because we are on full screen
		PointF canvasPoint = PaintroidApplication.perspective.getCanvasPointFromSurfacePoint(screenPoint);

		mSolo.clickOnScreen(screenPoint.x, screenPoint.y);
// 		mSolo.sleep(SHORT_SLEEP);
		int pixelColor = PaintroidApplication.drawingSurface.getPixel(canvasPoint);
		assertEquals("pixel should be black", Color.BLACK, pixelColor);
	}

	public void testHideStatusbar() {
		assertTrue("Waiting for DrawingSurface", mSolo.waitForView(DrawingSurface.class, 1, TIMEOUT));

		switchToFullscreen();

		PointF screenPoint = new PointF(mScreenWidth / 2, mScreenHeight - 10);
		// not converting screen point to surface point because we are on full screen
		PointF canvasPoint = PaintroidApplication.perspective.getCanvasPointFromSurfacePoint(screenPoint);

		mSolo.clickOnScreen(screenPoint.x, screenPoint.y);
		// mSolo.sleep(SHORT_SLEEP);
		int pixelColor = PaintroidApplication.drawingSurface.getPixel(canvasPoint);
		assertEquals("pixel should be black", Color.BLACK, pixelColor);
	}

	public void testShowToolbarOnBackPressed() {
		assertTrue("Waiting for DrawingSurface", mSolo.waitForView(DrawingSurface.class, 1, TIMEOUT));
		switchToFullscreen();

		int clickPointX = mScreenWidth / 2;
		int clickPointY = mScreenHeight - TOOLBAR_BOTTOM_OFFSET;
		mSolo.goBack();
		mSolo.clickOnScreen(clickPointX, clickPointY);
		int pixel = PaintroidApplication.drawingSurface.getPixel(new PointF(clickPointX, clickPointY
				- (int) Utils.getStatusbarHeight(getActivity()) * 2));
		assertEquals("pixel should be transparent", Color.TRANSPARENT, pixel);
		mSolo.goBack();
	}

	public void testShowStatusbarOnBackPressed() {
		assertTrue("Waiting for DrawingSurface", mSolo.waitForView(DrawingSurface.class, 1, TIMEOUT));
		switchToFullscreen();
		mSolo.goBack();

		int clickPointX = mScreenWidth / 2;
		int clickPointY = 0;

		boolean assertionFailedErrorCaught = false;
		try {
			mSolo.clickOnScreen(clickPointX, clickPointY);
		} catch (Throwable ex) { // CQA: Was AssertionFailedError in Robotium, not Espresso
			Log.i("Activity&Test", "Click on screen raised AssertionFailedError", ex);
			assertionFailedErrorCaught = true;
		} finally {
			assertTrue("assertion failed error should have been caught", assertionFailedErrorCaught);
		}

	}

	@dk.au.cs.thor.robotium2espresso.UnstableTest
	public void testShowToolbarOnMenuPressed() {
		assertTrue("Waiting for DrawingSurface", mSolo.waitForView(DrawingSurface.class, 1, TIMEOUT));
		switchToFullscreen();
		mSolo.sendKeyNoSpecialCase(Solo.MENU);

		int clickPointX = mScreenWidth / 2;
		int clickPointY = mScreenHeight - TOOLBAR_BOTTOM_OFFSET;

		try {
			mSolo.searchText(mSolo.getString(R.string.menu_save_image), 1, true, true);
			mSolo.goBack();
		} catch (Throwable assertion) { // CQA: Was AssertionFailedError in Robotium, not Espresso
			// compatibility check for older versions
		}
		mSolo.clickOnScreen(clickPointX, clickPointY);
		int pixel = PaintroidApplication.drawingSurface.getPixel(new PointF(clickPointX, clickPointY));
		assertEquals("pixel should be transparent", Color.TRANSPARENT, pixel);
	}

	@dk.au.cs.thor.robotium2espresso.UnstableTest
	public void testShowStatusbarOnMenuPressed() {
		assertTrue("Waiting for DrawingSurface", mSolo.waitForView(DrawingSurface.class, 1, TIMEOUT));
		switchToFullscreen();

		// mSolo.sleep(5000);

		mSolo.sendKeyNoSpecialCase(Solo.MENU);
		// mSolo.sleep(500);

		int clickPointX = mScreenWidth / 2;
		int clickPointY = 0;

		boolean assertionFailedErrorCaught = false;
		try {
			mSolo.clickOnScreen(clickPointX, clickPointY);
		} catch (Throwable ex) { // CQA: Was AssertionFailedError in Robotium, not Espresso
			assertionFailedErrorCaught = true;
		} finally {
			assertTrue("assertion failed error should have been caught", assertionFailedErrorCaught);
		}
	}

}
