package dk.au.cs.thor.robotium2espresso.widgets;

import dk.au.cs.thor.robotium2espresso.Solo;

import android.text.Editable;
import android.widget.EditText;

public class WeakEditText {
	private Updater<EditText> updater;

	public WeakEditText(EditText widget, Solo solo) {
		int id = widget.getId();
		updater = Updater.<EditText>fromId(id, solo);
	}

	public WeakEditText(Updater<EditText> updater) {
		this.updater = updater;
	}

	public Editable getText() {
		return updater.update().getText();
	}

	public int length() {
		return updater.update().length();
	}
}