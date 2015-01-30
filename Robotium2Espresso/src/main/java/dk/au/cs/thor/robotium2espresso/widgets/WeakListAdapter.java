package dk.au.cs.thor.robotium2espresso.widgets;

import dk.au.cs.thor.robotium2espresso.Solo;

import android.widget.ListAdapter;

public class WeakListAdapter {
	private Updater<ListAdapter> updater;

	public WeakListAdapter(Updater<ListAdapter> updater) {
		this.updater = updater;
	}

	public int getCount() {
		return updater.update().getCount();
	}
}