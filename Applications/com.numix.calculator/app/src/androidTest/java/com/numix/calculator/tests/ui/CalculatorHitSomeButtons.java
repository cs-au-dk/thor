package com.numix.calculator.test.ui;

import android.app.Activity;
import android.test.ActivityInstrumentationTestCase2;
import android.view.View;

import com.numix.calculator.Calculator;
import com.numix.calculator.view.CalculatorDisplay;
import com.numix.calculator.R;

import com.google.android.apps.common.testing.ui.espresso.matcher.BoundedMatcher;

import static com.google.android.apps.common.testing.ui.espresso.Espresso.onView;
import static com.google.android.apps.common.testing.ui.espresso.action.ViewActions.click;
import static com.google.android.apps.common.testing.ui.espresso.assertion.ViewAssertions.matches;
import static com.google.android.apps.common.testing.ui.espresso.matcher.ViewMatchers.withId;

import org.hamcrest.Description;
import org.hamcrest.Matcher;

import static org.hamcrest.Matchers.is;

public class CalculatorHitSomeButtons extends ActivityInstrumentationTestCase2<Calculator> {
    public static final String TAG = "CalculatorHitSomeButtons";

    Activity activity;

    public CalculatorHitSomeButtons() {
        super(Calculator.class);
    }

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        activity = getActivity();
    }

    @Override
    protected void tearDown() throws Exception {
        super.tearDown();
    }

    public void testCalculatorPlus() throws InterruptedException {
        onView(withId(R.id.digit2)).perform(click());
        onView(withId(R.id.plus)).perform(click());
        onView(withId(R.id.digit2)).perform(click());
        onView(withId(R.id.equal)).perform(click());
        onView(withId(R.id.display)).check(matches(withCalculatorDisplayText(is("4"))));
    }

    public static Matcher<View> withCalculatorDisplayText(final Matcher<String> stringMatcher) {
        return new BoundedMatcher<View, CalculatorDisplay>(CalculatorDisplay.class) {
            @Override
            public void describeTo(Description description) {
                description.appendText("with calculator display text: ");
                stringMatcher.describeTo(description);
            }

            @Override
            public boolean matchesSafely(CalculatorDisplay calculatorDisplay) {
                return stringMatcher.matches(calculatorDisplay.getText().toString());
            }
        };
    }
}