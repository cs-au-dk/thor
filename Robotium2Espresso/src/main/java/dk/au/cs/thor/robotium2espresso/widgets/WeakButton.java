package dk.au.cs.thor.robotium2espresso.widgets;

import dk.au.cs.thor.robotium2espresso.Solo;

import android.widget.Button;

public class WeakButton {
	private Updater<Button> updater;

	public WeakButton(Button widget, Solo solo) {
		int id = widget.getId();
		updater = Updater.<Button>fromId(id, solo);
	}

	public WeakButton(Updater<Button> updater) {
		this.updater = updater;
	}

	public boolean isEnabled() {
		return updater.update().isEnabled();
	}
}